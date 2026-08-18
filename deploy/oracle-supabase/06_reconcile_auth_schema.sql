-- Reconcile every auth.users column read by supabase/gotrue:v2.158.1.
-- Some early ForwardFlow installs retained GoTrue migration-history rows while
-- auth.users still came from the old bootstrap stub. GoTrue then reports its
-- migrations as applied, but any SELECT of a user fails at runtime. These
-- statements mirror the canonical user model and are safe to run repeatedly.

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'auth.users does not exist; GoTrue migrations have not completed';
  END IF;

  ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS instance_id uuid,
    ADD COLUMN IF NOT EXISTS aud varchar(255),
    ADD COLUMN IF NOT EXISTS role varchar(255),
    ADD COLUMN IF NOT EXISTS email varchar(255),
    ADD COLUMN IF NOT EXISTS encrypted_password varchar(255),
    ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS invited_at timestamptz,
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS phone_confirmed_at timestamptz,
    ADD COLUMN IF NOT EXISTS confirmation_token varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS recovery_token varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS recovery_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS email_change_token_current varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS email_change_token_new varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS email_change varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS email_change_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS email_change_confirm_status smallint DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phone_change_token varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS phone_change text DEFAULT '',
    ADD COLUMN IF NOT EXISTS phone_change_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS reauthentication_token varchar(255) DEFAULT '',
    ADD COLUMN IF NOT EXISTS reauthentication_sent_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz,
    ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb,
    ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb,
    ADD COLUMN IF NOT EXISTS is_super_admin boolean,
    ADD COLUMN IF NOT EXISTS created_at timestamptz,
    ADD COLUMN IF NOT EXISTS updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS banned_until timestamptz,
    ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
    ADD COLUMN IF NOT EXISTS is_sso_user boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

  -- `confirmed_at` is a compatibility field. A plain nullable column is used
  -- only as a recovery fallback; clean GoTrue migrations create it generated.
  ALTER TABLE auth.users
    ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

  CREATE INDEX IF NOT EXISTS users_is_anonymous_idx
    ON auth.users USING btree (is_anonymous);
  CREATE INDEX IF NOT EXISTS users_instance_id_idx
    ON auth.users USING btree (instance_id);
  CREATE INDEX IF NOT EXISTS users_instance_id_email_idx
    ON auth.users USING btree (instance_id, lower(email));
  CREATE UNIQUE INDEX IF NOT EXISTS users_email_partial_key
    ON auth.users (email) WHERE is_sso_user = false;

  ALTER TABLE auth.users OWNER TO supabase_auth_admin;
  GRANT ALL ON auth.users TO supabase_auth_admin;
END $$;
