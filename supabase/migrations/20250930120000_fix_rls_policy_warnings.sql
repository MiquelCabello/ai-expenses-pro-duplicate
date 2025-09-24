BEGIN;

-- Drop legacy profile policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Account users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage account profiles" ON public.profiles;
DROP POLICY IF EXISTS "Account members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users or admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Drop legacy categories policies
DROP POLICY IF EXISTS "All authenticated users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Account users can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories when allowed" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;
DROP POLICY IF EXISTS "Account members can view categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;

-- Drop legacy project code policies
DROP POLICY IF EXISTS "All authenticated users can view project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Admins can manage project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Account users can view project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Admins manage project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Account members can view project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Admins can insert project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Admins can update project codes" ON public.project_codes;
DROP POLICY IF EXISTS "Admins can delete project codes" ON public.project_codes;

-- Drop legacy file policies
DROP POLICY IF EXISTS "Users can view their own files" ON public.files;
DROP POLICY IF EXISTS "Users can upload files" ON public.files;
DROP POLICY IF EXISTS "Admins can view all files" ON public.files;
DROP POLICY IF EXISTS "Account users can view files" ON public.files;
DROP POLICY IF EXISTS "Users upload files within account" ON public.files;
DROP POLICY IF EXISTS "Users update their files" ON public.files;
DROP POLICY IF EXISTS "Account members can view files" ON public.files;
DROP POLICY IF EXISTS "Users can insert files" ON public.files;
DROP POLICY IF EXISTS "Users or admins can update files" ON public.files;
DROP POLICY IF EXISTS "Admins can delete files" ON public.files;

-- Drop legacy expense policies
DROP POLICY IF EXISTS "Employees can view their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can create their own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can update their own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can update all expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees view their expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees update own pending expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins view account expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins manage account expenses" ON public.expenses;
DROP POLICY IF EXISTS "Account members can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Account members can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Account members can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can delete expenses" ON public.expenses;
DROP POLICY IF EXISTS "exp_select_own" ON public.expenses;
DROP POLICY IF EXISTS "exp_insert_own" ON public.expenses;
DROP POLICY IF EXISTS "exp_update_own" ON public.expenses;
DROP POLICY IF EXISTS "exp_delete_own" ON public.expenses;

-- Drop legacy audit log policies
DROP POLICY IF EXISTS "Users can view their own audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "All authenticated users can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Account users view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Account users insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Account members can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Account members can insert audit logs" ON public.audit_logs;

DO $$
DECLARE
  has_account_id boolean := EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'account_id'
  );
BEGIN
  IF has_account_id THEN
    -- Multi-tenant policies ---------------------------------

    -- Profiles
    EXECUTE $$CREATE POLICY "profiles_select_account_members"
      ON public.profiles
      FOR SELECT
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
      );$$;

    EXECUTE $$CREATE POLICY "profiles_update_self_or_admin"
      ON public.profiles
      FOR UPDATE
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.profiles.account_id
          )
        )
      )
      WITH CHECK (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          user_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.profiles.account_id
          )
        )
      );$$;

    EXECUTE $$CREATE POLICY "profiles_insert_admin_only"
      ON public.profiles
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.profiles.account_id
        )
      );$$;

    EXECUTE $$CREATE POLICY "profiles_delete_admin_only"
      ON public.profiles
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.profiles.account_id
        )
      );$$;

    -- Categories
    EXECUTE $$CREATE POLICY "categories_select_account_members"
      ON public.categories
      FOR SELECT
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
      );$$;

    EXECUTE $$CREATE POLICY "categories_write_admin_only"
      ON public.categories
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.categories.account_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.categories.account_id
        )
      );$$;

    -- Project codes
    EXECUTE $$CREATE POLICY "project_codes_select_account_members"
      ON public.project_codes
      FOR SELECT
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
      );$$;

    EXECUTE $$CREATE POLICY "project_codes_write_admin_only"
      ON public.project_codes
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.project_codes.account_id
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.project_codes.account_id
        )
      );$$;

    -- Files
    EXECUTE $$CREATE POLICY "files_select_account_members"
      ON public.files
      FOR SELECT
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
      );$$;

    EXECUTE $$CREATE POLICY "files_insert_same_account"
      ON public.files
      FOR INSERT
      WITH CHECK (
        uploaded_by = (select auth.uid())
        AND account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
      );$$;

    EXECUTE $$CREATE POLICY "files_update_owner_or_admin"
      ON public.files
      FOR UPDATE
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          uploaded_by = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.files.account_id
          )
        )
      )
      WITH CHECK (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          uploaded_by = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.files.account_id
          )
        )
      );$$;

    EXECUTE $$CREATE POLICY "files_delete_admin_only"
      ON public.files
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.files.account_id
        )
      );$$;

    -- Expenses
    EXECUTE $$CREATE POLICY "expenses_select_account_members"
      ON public.expenses
      FOR SELECT
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          employee_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.expenses.account_id
          )
        )
      );$$;

    EXECUTE $$CREATE POLICY "expenses_insert_same_account"
      ON public.expenses
      FOR INSERT
      WITH CHECK (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          employee_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.expenses.account_id
          )
        )
      );$$;

    EXECUTE $$CREATE POLICY "expenses_update_owner_or_admin"
      ON public.expenses
      FOR UPDATE
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          (
            employee_id = (select auth.uid())
            AND status = 'PENDING'::public.expense_status
          )
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.expenses.account_id
          )
        )
      )
      WITH CHECK (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND (
          employee_id = (select auth.uid())
          OR EXISTS (
            SELECT 1
            FROM public.profiles admin_p
            WHERE admin_p.user_id = (select auth.uid())
              AND admin_p.role = 'ADMIN'
              AND admin_p.status = 'ACTIVE'
              AND admin_p.account_id = public.expenses.account_id
          )
        )
      );$$;

    EXECUTE $$CREATE POLICY "expenses_delete_admin_only"
      ON public.expenses
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
            AND admin_p.status = 'ACTIVE'
            AND admin_p.account_id = public.expenses.account_id
        )
      );$$;

    -- Audit logs
    EXECUTE $$CREATE POLICY "audit_logs_select_account_members"
      ON public.audit_logs
      FOR SELECT
      USING (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
      );$$;

    EXECUTE $$CREATE POLICY "audit_logs_insert_same_account"
      ON public.audit_logs
      FOR INSERT
      WITH CHECK (
        account_id = (
          SELECT p.account_id
          FROM public.profiles p
          WHERE p.user_id = (select auth.uid())
          ORDER BY p.created_at DESC
          LIMIT 1
        )
        AND actor_user_id = (select auth.uid())
      );$$;

  ELSE
    -- Single-tenant policies ---------------------------------

    -- Profiles
    EXECUTE $$CREATE POLICY "profiles_select_self_or_admin"
      ON public.profiles
      FOR SELECT
      USING (
        user_id = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    EXECUTE $$CREATE POLICY "profiles_update_self_or_admin"
      ON public.profiles
      FOR UPDATE
      USING (
        user_id = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      )
      WITH CHECK (
        user_id = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    EXECUTE $$CREATE POLICY "profiles_insert_admin_only"
      ON public.profiles
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    -- Categories
    EXECUTE $$CREATE POLICY "categories_select_authenticated"
      ON public.categories
      FOR SELECT
      USING (TRUE);$$;

    EXECUTE $$CREATE POLICY "categories_write_admin_only"
      ON public.categories
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    -- Project codes
    EXECUTE $$CREATE POLICY "project_codes_select_authenticated"
      ON public.project_codes
      FOR SELECT
      USING (TRUE);$$;

    EXECUTE $$CREATE POLICY "project_codes_write_admin_only"
      ON public.project_codes
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    -- Files
    EXECUTE $$CREATE POLICY "files_select_owner_or_admin"
      ON public.files
      FOR SELECT
      USING (
        uploaded_by = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    EXECUTE $$CREATE POLICY "files_insert_owner_only"
      ON public.files
      FOR INSERT
      WITH CHECK (
        uploaded_by = (select auth.uid())
      );$$;

    EXECUTE $$CREATE POLICY "files_update_owner_or_admin"
      ON public.files
      FOR UPDATE
      USING (
        uploaded_by = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      )
      WITH CHECK (
        uploaded_by = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    -- Expenses
    EXECUTE $$CREATE POLICY "expenses_select_owner_or_admin"
      ON public.expenses
      FOR SELECT
      USING (
        employee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    EXECUTE $$CREATE POLICY "expenses_insert_owner_only"
      ON public.expenses
      FOR INSERT
      WITH CHECK (
        employee_id = (select auth.uid())
      );$$;

    EXECUTE $$CREATE POLICY "expenses_update_owner_or_admin"
      ON public.expenses
      FOR UPDATE
      USING (
        (
          employee_id = (select auth.uid())
          AND status = 'PENDING'::public.expense_status
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      )
      WITH CHECK (
        employee_id = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    -- Audit logs
    EXECUTE $$CREATE POLICY "audit_logs_select_owner_or_admin"
      ON public.audit_logs
      FOR SELECT
      USING (
        actor_user_id = (select auth.uid())
        OR EXISTS (
          SELECT 1
          FROM public.profiles admin_p
          WHERE admin_p.user_id = (select auth.uid())
            AND admin_p.role = 'ADMIN'
        )
      );$$;

    EXECUTE $$CREATE POLICY "audit_logs_insert_owner_only"
      ON public.audit_logs
      FOR INSERT
      WITH CHECK (
        actor_user_id = (select auth.uid())
      );$$;

  END IF;
END;
$$;

-- Storage bucket policies (common)
DROP POLICY IF EXISTS "Users can view their own receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own receipt files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all receipt files" ON storage.objects;

CREATE POLICY "storage_receipts_select_own_or_admin"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'receipts'
  AND (
    (select auth.uid())::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1
      FROM public.profiles admin_p
      WHERE admin_p.user_id = (select auth.uid())
        AND admin_p.role = 'ADMIN'
    )
  )
);

CREATE POLICY "storage_receipts_insert_self"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'receipts'
  AND (select auth.uid())::text = (storage.foldername(name))[1]
);

COMMIT;
