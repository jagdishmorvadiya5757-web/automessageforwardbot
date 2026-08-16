-- ============================================================
-- 04_reset_auth.sql   (run BEFORE restarting the auth container)
--
-- Problem: 01_bootstrap.sql created a *stub* auth.users table.
-- GoTrue needs its own full auth schema, so signup/login fail with
-- "Database error finding user" / "Database error querying schema".
--
-- This script:
--   1. backs up every foreign key that points at auth.users
--   2. drops those foreign keys + the signup trigger
--   3. wipes every table in the auth schema (stub + half-migrated ones)
--   4. re-creates auth.uid() / auth.jwt() / auth.role() and grants
--
-- After running it, restart the auth container so GoTrue builds the
-- real auth schema from scratch, then run 05_relink_auth.sql.
--
--   sudo -u postgres psql -d forwardflow -f 04_reset_auth.sql
-- ============================================================

-- 1. back up FK definitions -------------------------------------------------
DROP TABLE IF EXISTS public._auth_fk_backup;
CREATE TABLE public._auth_fk_backup (
  table_schema text,
  table_name   text,
  constraint_name text,
  definition   text
);

INSERT INTO public._auth_fk_backup
SELECT n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class c   ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE con.contype = 'f'
  AND con.confrelid = 'auth.users'::regclass;

-- 2. drop them + the signup trigger ----------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public._auth_fk_backup LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
                   r.table_schema, r.table_name, r.constraint_name);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. wipe the auth schema's tables ------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'auth' LOOP
    EXECUTE format('DROP TABLE IF EXISTS auth.%I CASCADE', r.tablename);
  END LOOP;
END $$;

-- 4. helper functions GoTrue does not own -----------------------------------
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'role'
$$;

GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role()
  TO anon, authenticated, service_role;

-- GoTrue must fully own its schema
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
