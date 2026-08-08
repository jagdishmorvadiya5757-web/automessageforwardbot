-- ============================================================
-- 01_bootstrap.sql
-- Run this FIRST on your own Postgres (Oracle VM) before 02_schema.sql
-- It recreates the pieces that the hosted backend provided for free:
--   * pgcrypto (gen_random_uuid)
--   * the anon / authenticated / service_role roles
--   * a minimal auth schema: auth.users + auth.uid()
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- roles ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- ---------- auth schema ----------
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE,
  phone         text,
  password_hash text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON auth.users TO authenticated;
GRANT ALL    ON auth.users TO service_role;

-- The current user id is passed per-connection via SET LOCAL app.user_id = '<uuid>'
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

-- ---------- public schema defaults ----------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
