-- Multi-tenant accounts migration

-- 1. Plans enum
CREATE TYPE IF NOT EXISTS public.account_plan AS ENUM ('FREE', 'PROFESSIONAL', 'ENTERPRISE');

-- 2. Accounts table
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  plan public.account_plan NOT NULL DEFAULT 'FREE',
  max_employees INTEGER,
  can_assign_roles BOOLEAN NOT NULL DEFAULT FALSE,
  can_assign_department BOOLEAN NOT NULL DEFAULT FALSE,
  can_assign_region BOOLEAN NOT NULL DEFAULT FALSE,
  can_add_custom_categories BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX accounts_owner_user_id_key ON public.accounts(owner_user_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- 3. Add account_id columns to existing tables
ALTER TABLE public.profiles ADD COLUMN account_id UUID;
ALTER TABLE public.categories ADD COLUMN account_id UUID;
ALTER TABLE public.project_codes ADD COLUMN account_id UUID;
ALTER TABLE public.files ADD COLUMN account_id UUID;
ALTER TABLE public.expenses ADD COLUMN account_id UUID;
ALTER TABLE public.audit_logs ADD COLUMN account_id UUID;

-- 4. Relax uniqueness to per-account scope
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_name_key;
ALTER TABLE public.project_codes DROP CONSTRAINT IF EXISTS project_codes_code_key;

-- 5. Helper functions
CREATE OR REPLACE FUNCTION public.get_account_id(_uid UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id
  FROM public.profiles
  WHERE user_id = _uid
  ORDER BY created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _uid
      AND role = 'ADMIN'::public.user_role
      AND status = 'ACTIVE'::public.user_status
  );
$$;

CREATE OR REPLACE FUNCTION public.get_account_plan(_account_id UUID)
RETURNS public.account_plan
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT plan FROM public.accounts WHERE id = _account_id;
$$;

CREATE OR REPLACE FUNCTION public.seed_account_defaults(_account_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.categories (name, budget_monthly, account_id)
  VALUES
    ('Viajes', 2000, _account_id),
    ('Dietas', 500, _account_id),
    ('Transporte', 800, _account_id),
    ('Alojamiento', 1500, _account_id),
    ('Material', 1000, _account_id),
    ('Software', 300, _account_id),
    ('Otros', NULL, _account_id)
  ON CONFLICT (account_id, name) DO NOTHING;

  INSERT INTO public.project_codes (code, name, status, account_id)
  VALUES
    ('PRJ-001', 'Proyecto General', 'ACTIVE', _account_id),
    ('PRJ-CLIENTE-A', 'Cliente A - Desarrollo', 'ACTIVE', _account_id),
    ('INT-OPS', 'Operaciones Internas', 'ACTIVE', _account_id)
  ON CONFLICT (account_id, code) DO NOTHING;
END;
$$;

-- 6. Trigger to enforce employee limits and plan features
CREATE OR REPLACE FUNCTION public.enforce_profile_plan_policies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account public.accounts%ROWTYPE;
  active_count INTEGER;
BEGIN
  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;

  SELECT * INTO v_account FROM public.accounts WHERE id = NEW.account_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account % not found', NEW.account_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'ACTIVE' THEN
      SELECT COUNT(*) INTO active_count
      FROM public.profiles
      WHERE account_id = NEW.account_id
        AND status = 'ACTIVE';
      IF v_account.max_employees IS NOT NULL AND active_count >= v_account.max_employees THEN
        RAISE EXCEPTION 'EMPLOYEE_LIMIT_REACHED';
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'ACTIVE' AND (OLD.status IS DISTINCT FROM 'ACTIVE') THEN
      SELECT COUNT(*) INTO active_count
      FROM public.profiles
      WHERE account_id = NEW.account_id
        AND status = 'ACTIVE'
        AND id <> NEW.id;
      IF v_account.max_employees IS NOT NULL AND active_count >= v_account.max_employees THEN
        RAISE EXCEPTION 'EMPLOYEE_LIMIT_REACHED';
      END IF;
    END IF;
  END IF;

  IF NOT v_account.can_assign_department THEN
    NEW.department := NULL;
  END IF;

  IF NOT v_account.can_assign_region THEN
    NEW.region := NULL;
  END IF;

  IF NOT v_account.can_assign_roles AND NEW.user_id <> v_account.owner_user_id THEN
    NEW.role := 'EMPLOYEE'::public.user_role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_plan_policies ON public.profiles;
CREATE TRIGGER enforce_profile_plan_policies
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_plan_policies();

-- 7. Update handle_new_user to build accounts and profiles appropriately
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
  v_max INTEGER;
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

    INSERT INTO public.accounts (
      owner_user_id,
      name,
      plan,
      max_employees,
      can_assign_roles,
      can_assign_department,
      can_assign_region,
      can_add_custom_categories
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'company_name', v_name),
      v_plan,
      CASE v_plan
        WHEN 'FREE' THEN 2
        WHEN 'PROFESSIONAL' THEN 25
        ELSE NULL
      END,
      CASE v_plan
        WHEN 'FREE' THEN FALSE
        ELSE TRUE
      END,
      CASE v_plan
        WHEN 'FREE' THEN FALSE
        ELSE TRUE
      END,
      CASE v_plan
        WHEN 'FREE' THEN FALSE
        ELSE TRUE
      END,
      CASE v_plan
        WHEN 'ENTERPRISE' THEN TRUE
        ELSE FALSE
      END
    )
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
    v_max := v_account.max_employees;

    IF v_max IS NOT NULL THEN
      SELECT COUNT(*) INTO v_existing_count
      FROM public.profiles
      WHERE account_id = v_account_id
        AND status = 'ACTIVE';
      IF v_existing_count >= v_max THEN
        RAISE EXCEPTION 'EMPLOYEE_LIMIT_REACHED';
      END IF;
    END IF;

    v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'EMPLOYEE'::public.user_role);
    IF NOT v_account.can_assign_roles AND NEW.id <> v_account.owner_user_id THEN
      v_role := 'EMPLOYEE'::public.user_role;
    END IF;

    IF NOT v_account.can_assign_department THEN
      v_department := NULL;
    END IF;
    IF NOT v_account.can_assign_region THEN
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

-- 8. Seed accounts for existing profiles
WITH base_accounts AS (
  INSERT INTO public.accounts (
    owner_user_id,
    name,
    plan,
    max_employees,
    can_assign_roles,
    can_assign_department,
    can_assign_region,
    can_add_custom_categories
  )
  SELECT
    p.user_id,
    p.name,
    'FREE'::public.account_plan,
    2,
    FALSE,
    FALSE,
    FALSE,
    FALSE
  FROM public.profiles p
  ON CONFLICT (owner_user_id) DO NOTHING
  RETURNING id, owner_user_id
)
UPDATE public.profiles pr
SET account_id = ba.id
FROM base_accounts ba
WHERE pr.user_id = ba.owner_user_id;

-- Assign any remaining profiles to their own account if missing
UPDATE public.profiles pr
SET account_id = a.id
FROM public.accounts a
WHERE pr.account_id IS NULL
  AND pr.user_id = a.owner_user_id;

-- Default categories and project codes to the first account for existing data
DO $$
DECLARE
  v_first_account UUID;
BEGIN
  SELECT id INTO v_first_account
  FROM public.accounts
  ORDER BY created_at
  LIMIT 1;

  IF v_first_account IS NOT NULL THEN
    UPDATE public.categories SET account_id = v_first_account WHERE account_id IS NULL;
    UPDATE public.project_codes SET account_id = v_first_account WHERE account_id IS NULL;
  END IF;
END
$$;

-- Update files/audit logs/expenses with account_id via user relations
UPDATE public.files f
SET account_id = public.get_account_id(f.uploaded_by)
WHERE f.account_id IS NULL;

UPDATE public.audit_logs al
SET account_id = public.get_account_id(al.actor_user_id)
WHERE al.account_id IS NULL;

UPDATE public.expenses e
SET account_id = public.get_account_id(e.employee_id)
WHERE e.account_id IS NULL;

-- 9. Ensure all account_id columns are NOT NULL and add FKs
ALTER TABLE public.profiles ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.project_codes ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.files ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE public.audit_logs ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE CASCADE;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE CASCADE;

ALTER TABLE public.project_codes
  ADD CONSTRAINT project_codes_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE CASCADE;

ALTER TABLE public.files
  ADD CONSTRAINT files_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE CASCADE;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE CASCADE;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_account_id_fkey
  FOREIGN KEY (account_id)
  REFERENCES public.accounts(id)
  ON DELETE CASCADE;

-- 10. Recreate indexes scoped by account
CREATE UNIQUE INDEX categories_account_name_key ON public.categories(account_id, name);
CREATE UNIQUE INDEX project_codes_account_code_key ON public.project_codes(account_id, code);
CREATE INDEX files_account_id_idx ON public.files(account_id);
CREATE INDEX expenses_account_id_idx ON public.expenses(account_id);
CREATE INDEX audit_logs_account_id_idx ON public.audit_logs(account_id);
CREATE INDEX profiles_account_id_idx ON public.profiles(account_id);

-- 11. Seed defaults for all accounts (idempotent thanks to conflicts)
SELECT public.seed_account_defaults(id) FROM public.accounts;

-- 12. Update RLS policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;

CREATE POLICY "Account users can view profiles"
ON public.profiles
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Users can update their profile"
ON public.profiles
FOR UPDATE
USING (
  user_id = auth.uid()
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Admins manage account profiles"
ON public.profiles
FOR ALL
USING (
  public.is_account_admin(auth.uid())
  AND account_id = public.get_account_id(auth.uid())
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
);

-- Categories policies
DROP POLICY IF EXISTS "All authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;

CREATE POLICY "Account users can view categories"
ON public.categories
FOR SELECT
USING (account_id = public.get_account_id(auth.uid()));

CREATE POLICY "Admins can update categories"
ON public.categories
FOR UPDATE
USING (
  public.is_account_admin(auth.uid())
  AND account_id = public.get_account_id(auth.uid())
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Admins can insert categories when allowed"
ON public.categories
FOR INSERT
WITH CHECK (
  public.is_account_admin(auth.uid())
  AND account_id = public.get_account_id(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.accounts
    WHERE id = account_id
      AND can_add_custom_categories = TRUE
  )
);

CREATE POLICY "Admins can delete categories"
ON public.categories
FOR DELETE
USING (
  public.is_account_admin(auth.uid())
  AND account_id = public.get_account_id(auth.uid())
);

-- Project codes policies
DROP POLICY IF EXISTS "All authenticated users can view project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Admins can manage project codes" ON public.project_codes;

CREATE POLICY "Account users can view project codes"
ON public.project_codes
FOR SELECT
USING (account_id = public.get_account_id(auth.uid()));

CREATE POLICY "Admins manage project codes"
ON public.project_codes
FOR ALL
USING (
  public.is_account_admin(auth.uid())
  AND account_id = public.get_account_id(auth.uid())
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
);

-- Files policies
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
DROP POLICY IF EXISTS "Users can upload files" ON public.files;
DROP POLICY IF EXISTS "Admins can view all files" ON public.files;

CREATE POLICY "Account users can view files"
ON public.files
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Users upload files within account"
ON public.files
FOR INSERT
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  AND uploaded_by = auth.uid()
);

CREATE POLICY "Users update their files"
ON public.files
FOR UPDATE
USING (
  uploaded_by = auth.uid()
  AND account_id = public.get_account_id(auth.uid())
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
);

-- Expenses policies
DROP POLICY IF EXISTS "Employees can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can update their own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update all expenses" ON public.expenses;

CREATE POLICY "Employees view their expenses"
ON public.expenses
FOR SELECT
USING (
  employee_id = auth.uid()
  AND account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Employees insert expenses"
ON public.expenses
FOR INSERT
WITH CHECK (
  employee_id = auth.uid()
  AND account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Employees update own pending expenses"
ON public.expenses
FOR UPDATE
USING (
  employee_id = auth.uid()
  AND status = 'PENDING'::public.expense_status
  AND account_id = public.get_account_id(auth.uid())
)
WITH CHECK (
  employee_id = auth.uid()
  AND account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Admins view account expenses"
ON public.expenses
FOR SELECT
USING (
  public.is_account_admin(auth.uid())
  AND account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Admins manage account expenses"
ON public.expenses
FOR ALL
USING (
  public.is_account_admin(auth.uid())
  AND account_id = public.get_account_id(auth.uid())
)
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
);

-- Audit logs policies
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "All authenticated users can create audit logs" ON public.audit_logs;

CREATE POLICY "Account users view audit logs"
ON public.audit_logs
FOR SELECT
USING (
  account_id = public.get_account_id(auth.uid())
);

CREATE POLICY "Account users insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (
  account_id = public.get_account_id(auth.uid())
  AND actor_user_id = auth.uid()
);

-- 13. Accounts policies
CREATE POLICY "Account owners view account"
ON public.accounts
FOR SELECT
USING (
  id = public.get_account_id(auth.uid())
);

CREATE POLICY "Account owners update account"
ON public.accounts
FOR UPDATE
USING (
  id = public.get_account_id(auth.uid())
  AND public.is_account_admin(auth.uid())
)
WITH CHECK (
  id = public.get_account_id(auth.uid())
);

-- 14. Ensure update trigger for accounts timestamps
DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts;
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
