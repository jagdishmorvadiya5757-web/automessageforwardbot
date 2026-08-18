-- Run ONCE on the Oracle VM, as the postgres superuser, against the forwardflow DB:
--   sudo -u postgres psql -d forwardflow -f 03_api_roles.sql
--
-- Creates the roles that PostgREST and GoTrue need, on top of the schema you
-- already imported. Replace the two passwords first (same values as in .env).

\set authenticator_password 'AUTHENTICATOR_PASSWORD'
\set auth_admin_password 'AUTH_PASSWORD'

-- ---------------------------------------------------------------- API roles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE format('CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD %L', :'authenticator_password');
  ELSE
    EXECUTE format('ALTER ROLE authenticator PASSWORD %L', :'authenticator_password');
  END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;

-- --------------------------------------------------------------- Auth schema
CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE format('CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE PASSWORD %L', :'auth_admin_password');
  ELSE
    EXECUTE format('ALTER ROLE supabase_auth_admin PASSWORD %L', :'auth_admin_password');
  END IF;
END $$;

GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path = auth, public;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- auth.uid() / auth.role() / auth.jwt() as PostgREST exposes them
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'role'
$$;

GRANT EXECUTE ON FUNCTION auth.jwt(), auth.uid(), auth.role() TO anon, authenticated, service_role;

-- ------------------------------------------------------- Data API privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
