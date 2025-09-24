-- Account plan enhancements: master access, monthly limits, plan helpers

-- 1. Ensure monthly expense limit column exists
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS monthly_expense_limit INTEGER;

-- 2. Helper function to centralize plan settings
CREATE OR REPLACE FUNCTION public.plan_settings(_plan public.account_plan)
RETURNS TABLE (
  max_employees INTEGER,
  can_assign_roles BOOLEAN,
  can_assign_department BOOLEAN,
  can_assign_region BOOLEAN,
  can_add_custom_categories BOOLEAN,
  monthly_expense_limit INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE _plan
      WHEN 'FREE' THEN 2
      WHEN 'PROFESSIONAL' THEN 25
      ELSE NULL
    END,
    CASE _plan
      WHEN 'FREE' THEN FALSE
      ELSE TRUE
    END,
    CASE _plan
      WHEN 'FREE' THEN FALSE
      ELSE TRUE
    END,
    CASE _plan
      WHEN 'FREE' THEN FALSE
      ELSE TRUE
    END,
    CASE _plan
      WHEN 'ENTERPRISE' THEN TRUE
      ELSE FALSE
    END,
    CASE _plan
      WHEN 'FREE' THEN 50
      ELSE NULL
    END;
END;
$$;

-- 3. Bring existing accounts in sync with helper defaults
UPDATE public.accounts a
SET
  max_employees = ps.max_employees,
  can_assign_roles = ps.can_assign_roles,
  can_assign_department = ps.can_assign_department,
  can_assign_region = ps.can_assign_region,
  can_add_custom_categories = ps.can_add_custom_categories,
  monthly_expense_limit = ps.monthly_expense_limit
FROM public.plan_settings(a.plan) ps;

-- 4. Master user helper (uses email claim)
CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
SELECT LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'info@miquelcabello.com';
$$;

-- 5. Update handle_new_user to reuse plan_settings + monthly limits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
  v_plan public.account_plan;
  v_role public.user_role;
  v_name TEXT;
  v_department TEXT;
  v_region TEXT;
  v_existing_count INTEGER;
  v_account public.accounts%ROWTYPE;
  v_settings RECORD;
BEGIN
  v_account_id := NULL;
  v_role := 'EMPLOYEE'::public.user_role;
  v_name := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  v_department := NEW.raw_user_meta_data->>'department';
  v_region := NEW.raw_user_meta_data->>'region';

  IF NEW.raw_user_meta_data ? 'account_id' THEN
    v_account_id := (NEW.raw_user_meta_data->>'account_id')::UUID;
  END IF;

  IF v_account_id IS NULL THEN
    v_plan := COALESCE((NEW.raw_user_meta_data->>'plan')::public.account_plan, 'FREE');
    SELECT * INTO v_settings FROM public.plan_settings(v_plan);

    INSERT INTO public.accounts (
      owner_user_id,
      name,
      plan,
      max_employees,
      can_assign_roles,
      can_assign_department,
      can_assign_region,
      can_add_custom_categories,
      monthly_expense_limit
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', v_name),
      v_plan,
      v_settings.max_employees,
      v_settings.can_assign_roles,
      v_settings.can_assign_department,
      v_settings.can_assign_region,
      v_settings.can_add_custom_categories,
      v_settings.monthly_expense_limit
    )
    ON CONFLICT (owner_user_id) DO UPDATE
    SET
      plan = EXCLUDED.plan,
      max_employees = EXCLUDED.max_employees,
      can_assign_roles = EXCLUDED.can_assign_roles,
      can_assign_department = EXCLUDED.can_assign_department,
      can_assign_region = EXCLUDED.can_assign_region,
      can_add_custom_categories = EXCLUDED.can_add_custom_categories,
      monthly_expense_limit = EXCLUDED.monthly_expense_limit
    RETURNING id INTO v_account_id;

    PERFORM public.seed_account_defaults(v_account_id);

    v_role := 'ADMIN'::public.user_role;
    v_department := NULL;
    v_region := NULL;
  ELSE
    SELECT * INTO v_account FROM public.accounts WHERE id = v_account_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Account % not found', v_account_id;
    END IF;

    v_plan := v_account.plan;
    SELECT * INTO v_settings FROM public.plan_settings(v_plan);

    IF v_settings.max_employees IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_count
      FROM public.profiles
      WHERE account_id = v_account_id
        AND status = 'ACTIVE';
      IF v_existing_count >= v_settings.max_employees THEN
        RAISE EXCEPTION 'EMPLOYEE_LIMIT_REACHED';
      END IF;
    END IF;

    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'EMPLOYEE'::public.user_role);
    IF NOT v_settings.can_assign_roles AND NEW.id <> v_account.owner_user_id THEN
      v_role := 'EMPLOYEE'::public.user_role;
    END IF;

    IF NOT v_settings.can_assign_department THEN
      v_department := NULL;
    END IF;
    IF NOT v_settings.can_assign_region THEN
      v_region := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (user_id, name, role, department, region, account_id)
  VALUES (
    NEW.id,
    v_name,
    v_role,
    v_department,
    v_region,
    v_account_id
  );

  RETURN NEW;
END;
$$;

-- 6. Expense limit enforcement trigger
CREATE OR REPLACE FUNCTION public.enforce_expense_plan_policies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.accounts%ROWTYPE;
  v_month_start DATE;
  v_month_end DATE;
  v_existing INTEGER;
  v_limit INTEGER;
BEGIN
  IF NEW.employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  IF NEW.account_id IS NULL THEN
    NEW.account_id := public.get_account_id(NEW.employee_id);
  END IF;

  SELECT * INTO v_account FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % not found for expense', NEW.account_id;
  END IF;

  v_limit := COALESCE(v_account.monthly_expense_limit, NULL);
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  v_month_start := date_trunc('month', COALESCE(NEW.expense_date, CURRENT_DATE))::DATE;
  v_month_end := (v_month_start + INTERVAL '1 month')::DATE;

  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO v_existing
    FROM public.expenses
    WHERE account_id = NEW.account_id
      AND expense_date >= v_month_start
      AND expense_date < v_month_end;

    IF v_existing >= v_limit THEN
      RAISE EXCEPTION 'EXPENSE_LIMIT_REACHED';
    END IF;
  ELSE
    IF NEW.account_id IS DISTINCT FROM OLD.account_id
       OR date_trunc('month', NEW.expense_date) <> date_trunc('month', OLD.expense_date)
    THEN
      SELECT COUNT(*) INTO v_existing
      FROM public.expenses
      WHERE account_id = NEW.account_id
        AND expense_date >= v_month_start
        AND expense_date < v_month_end
        AND id <> NEW.id;

      IF v_existing >= v_limit THEN
        RAISE EXCEPTION 'EXPENSE_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_expense_plan_policies ON public.expenses;
CREATE TRIGGER enforce_expense_plan_policies
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.enforce_expense_plan_policies();

-- 7. Refresh RLS policies with master access
-- Profiles
DROP POLICY IF EXISTS "Account users can view profiles" ON public.profiles;
CREATE POLICY "Account users can view profiles"
ON public.profiles
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
CREATE POLICY "Users can update their profile"
ON public.profiles
FOR UPDATE
USING (
  user_id = auth.uid() OR public.is_master_user()
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Admins manage account profiles" ON public.profiles;
CREATE POLICY "Admins manage account profiles"
ON public.profiles
FOR ALL
USING (
  (public.is_account_admin(auth.uid()) AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

-- Categories
DROP POLICY IF EXISTS "Account users can view categories" ON public.categories;
CREATE POLICY "Account users can view categories"
ON public.categories
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
CREATE POLICY "Admins can update categories"
ON public.categories
FOR UPDATE
USING (
  (public.is_account_admin(auth.uid()) AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Admins can insert categories when allowed" ON public.categories;
CREATE POLICY "Admins can insert categories when allowed"
ON public.categories
FOR INSERT
WITH CHECK (
  (
    public.is_account_admin(auth.uid())
    AND account_id = public.get_account_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.accounts
      WHERE id = account_id
        AND can_add_custom_categories = TRUE
    )
  )
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
CREATE POLICY "Admins can delete categories"
ON public.categories
FOR DELETE
USING (
  (public.is_account_admin(auth.uid()) AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
);

-- Project codes
DROP POLICY IF EXISTS "Account users can view project codes" ON public.project_codes;
CREATE POLICY "Account users can view project codes"
ON public.project_codes
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Admins manage project codes" ON public.project_codes;
CREATE POLICY "Admins manage project codes"
ON public.project_codes
FOR ALL
USING (
  (public.is_account_admin(auth.uid()) AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

-- Files
DROP POLICY IF EXISTS "Account users can view files" ON public.files;
CREATE POLICY "Account users can view files"
ON public.files
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Users upload files within account" ON public.files;
CREATE POLICY "Users upload files within account"
ON public.files
FOR INSERT
WITH CHECK (
  (account_id = public.get_account_id(auth.uid()) AND uploaded_by = auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Users update their files" ON public.files;
CREATE POLICY "Users update their files"
ON public.files
FOR UPDATE
USING (
  (uploaded_by = auth.uid() AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

-- Expenses
DROP POLICY IF EXISTS "Employees view their expenses" ON public.expenses;
CREATE POLICY "Employees view their expenses"
ON public.expenses
FOR SELECT
USING (
  (employee_id = auth.uid() AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Employees insert expenses" ON public.expenses;
CREATE POLICY "Employees insert expenses"
ON public.expenses
FOR INSERT
WITH CHECK (
  (employee_id = auth.uid() AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Employees update own pending expenses" ON public.expenses;
CREATE POLICY "Employees update own pending expenses"
ON public.expenses
FOR UPDATE
USING (
  (employee_id = auth.uid() AND status = 'PENDING'::public.expense_status AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
)
WITH CHECK (
  (employee_id = auth.uid() AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Admins view account expenses" ON public.expenses;
CREATE POLICY "Admins view account expenses"
ON public.expenses
FOR SELECT
USING (
  (public.is_account_admin(auth.uid()) AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Admins manage account expenses" ON public.expenses;
CREATE POLICY "Admins manage account expenses"
ON public.expenses
FOR ALL
USING (
  (public.is_account_admin(auth.uid()) AND account_id = public.get_account_id(auth.uid()))
  OR public.is_master_user()
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

-- Audit logs
DROP POLICY IF EXISTS "Account users view audit logs" ON public.audit_logs;
CREATE POLICY "Account users view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Account users insert audit logs" ON public.audit_logs;
CREATE POLICY "Account users insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  (account_id = public.get_account_id(auth.uid()) AND actor_user_id = auth.uid())
  OR public.is_master_user()
);

-- Accounts
DROP POLICY IF EXISTS "Account owners view account" ON public.accounts;
CREATE POLICY "Account owners view account"
ON public.accounts
FOR SELECT
USING (
  id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);

DROP POLICY IF EXISTS "Account owners update account" ON public.accounts;
CREATE POLICY "Account owners update account"
ON public.accounts
FOR UPDATE
USING (
  (id = public.get_account_id(auth.uid()) AND public.is_account_admin(auth.uid()))
  OR public.is_master_user()
)
WITH CHECK (
  id = public.get_account_id(auth.uid())
  OR public.is_master_user()
);
