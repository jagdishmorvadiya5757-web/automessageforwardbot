-- ============================================================
-- 05_relink_auth.sql  (run AFTER the auth container restarted and
--                      GoTrue re-created the real auth.users table)
--
--   sudo -u postgres psql -d forwardflow -f 05_relink_auth.sql
--
-- Restores the foreign keys backed up by 04_reset_auth.sql, the
-- signup trigger, and read access for the API roles.
-- ============================================================

-- Safety: fail loudly if GoTrue has not created its table yet.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users'
      AND column_name = 'encrypted_password'
  ) THEN
    RAISE EXCEPTION 'auth.users is not the GoTrue table yet — restart the auth container first';
  END IF;
END $$;

-- 1. restore foreign keys ----------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public._auth_fk_backup LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = r.constraint_name
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s',
                     r.table_schema, r.table_name, r.constraint_name, r.definition);
    END IF;
  END LOOP;
END $$;

-- 2. re-attach the signup trigger -------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. API role access ---------------------------------------------------------
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auth TO service_role;

DROP TABLE IF EXISTS public._auth_fk_backup;
