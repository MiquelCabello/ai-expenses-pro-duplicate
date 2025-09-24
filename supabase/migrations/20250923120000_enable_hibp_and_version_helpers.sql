-- Enable leaked password protection (HIBP integration) at the auth configuration level, when the auth.config table is available.
DO $$
DECLARE
  cfg_id integer;
  hibp_enabled boolean;
BEGIN
  IF to_regclass('auth.config') IS NULL THEN
    RAISE NOTICE 'auth.config relation not present on this instance, skipping leaked password protection toggle.';
    RETURN;
  END IF;

  SELECT id,
         coalesce((data #>> '{password,hibp,enabled}')::boolean, false)
    INTO cfg_id, hibp_enabled
  FROM auth.config
  ORDER BY id
  LIMIT 1;

  IF cfg_id IS NULL THEN
    RAISE NOTICE 'auth.config table not initialised, skipping leaked password protection toggle.';
    RETURN;
  END IF;

  IF hibp_enabled THEN
    RAISE NOTICE 'Leaked password protection already enabled.';
    RETURN;
  END IF;

  UPDATE auth.config
     SET data = jsonb_set(
                  data,
                  '{password}',
                  coalesce(data->'password', '{}'::jsonb) ||
                    jsonb_build_object(
                      'hibp',
                      coalesce(data->'password'->'hibp', '{}'::jsonb) ||
                        jsonb_build_object('enabled', true)
                    ),
                  true
                ),
         updated_at = timezone('utc', now())
   WHERE id = cfg_id;

  RAISE NOTICE 'Enabled leaked password protection using HaveIBeenPwned integration.';
END $$;

-- Helper function to expose whether leaked password protection is active.
CREATE OR REPLACE FUNCTION public.is_leaked_password_protection_enabled()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result boolean;
BEGIN
  IF to_regclass('auth.config') IS NULL THEN
    RETURN false;
  END IF;

  EXECUTE '
    SELECT (data #>> ''{password,hibp,enabled}'')::boolean
    FROM auth.config
    ORDER BY id
    LIMIT 1
  '
  INTO result;

  RETURN coalesce(result, false);
END;
$$;

COMMENT ON FUNCTION public.is_leaked_password_protection_enabled() IS
  'Returns true when Supabase Auth is rejecting leaked passwords via the HIBP integration.';

REVOKE ALL ON FUNCTION public.is_leaked_password_protection_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leaked_password_protection_enabled() TO postgres, service_role, authenticated;

-- Function that surfaces the precise Postgres version currently running.
CREATE OR REPLACE FUNCTION public.current_postgres_version()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT version();
$$;

COMMENT ON FUNCTION public.current_postgres_version() IS
  'Exposes the output of the Postgres version() call for operational monitoring.';

REVOKE ALL ON FUNCTION public.current_postgres_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_postgres_version() TO postgres, service_role, authenticated;
