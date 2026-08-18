-- Reconcile columns expected by supabase/gotrue:v2.158.1.
-- Some early ForwardFlow installs retained GoTrue migration-history rows while
-- auth.users still came from the old bootstrap stub. These statements mirror
-- GoTrue's canonical migrations and are safe to run repeatedly.

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users does not exist; GoTrue migrations have not completed';
  END IF;

  ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

  CREATE INDEX IF NOT EXISTS users_is_anonymous_idx
    ON auth.users USING btree (is_anonymous);
END $$;
