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
  CREATE UNIQUE INDEX IF NOT EXISTS confirmation_token_idx
    ON auth.users (confirmation_token) WHERE confirmation_token !~ '^[0-9 ]*$';
  CREATE UNIQUE INDEX IF NOT EXISTS recovery_token_idx
    ON auth.users (recovery_token) WHERE recovery_token !~ '^[0-9 ]*$';
  CREATE UNIQUE INDEX IF NOT EXISTS email_change_token_current_idx
    ON auth.users (email_change_token_current) WHERE email_change_token_current !~ '^[0-9 ]*$';
  CREATE UNIQUE INDEX IF NOT EXISTS email_change_token_new_idx
    ON auth.users (email_change_token_new) WHERE email_change_token_new !~ '^[0-9 ]*$';
  CREATE UNIQUE INDEX IF NOT EXISTS reauthentication_token_idx
    ON auth.users (reauthentication_token) WHERE reauthentication_token !~ '^[0-9 ]*$';

  ALTER TABLE auth.users OWNER TO supabase_auth_admin;
  GRANT ALL ON auth.users TO supabase_auth_admin;
END $$;

-- FindUserByEmailAndAudience uses Pop's Eager() loader. That means a lookup on
-- auth.users also reads identities and mfa_factors before signup inserts
-- anything. A partially migrated related table therefore surfaces as the
-- misleading "Database error finding user" response even when users itself is
-- complete. Reconcile the v2.158.1 model fields used by those eager relations.
DO $$
BEGIN
  IF to_regclass('auth.identities') IS NULL THEN
    RAISE EXCEPTION 'auth.identities does not exist; GoTrue migrations have not completed';
  END IF;

  -- Old installs used the provider identifier as `id`. The current model needs
  -- a UUID primary key named id and stores the provider identifier separately.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities'
      AND column_name = 'id' AND data_type = 'text'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'identities'
      AND column_name = 'provider_id'
  ) THEN
    ALTER TABLE auth.identities RENAME COLUMN id TO provider_id;
  END IF;

  ALTER TABLE auth.identities
    ADD COLUMN IF NOT EXISTS provider_id text,
    ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
    ADD COLUMN IF NOT EXISTS email text GENERATED ALWAYS AS (lower(identity_data ->> 'email')) STORED;
  UPDATE auth.identities SET id = gen_random_uuid() WHERE id IS NULL;
  ALTER TABLE auth.identities ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE auth.identities ALTER COLUMN id SET NOT NULL;

  IF to_regclass('auth.mfa_factors') IS NULL THEN
    RAISE EXCEPTION 'auth.mfa_factors does not exist; GoTrue migrations have not completed';
  END IF;

  ALTER TABLE auth.mfa_factors
    ADD COLUMN IF NOT EXISTS phone text,
    ADD COLUMN IF NOT EXISTS last_challenged_at timestamptz;

  CREATE INDEX IF NOT EXISTS identities_user_id_idx
    ON auth.identities USING btree (user_id);
  CREATE INDEX IF NOT EXISTS identities_email_idx
    ON auth.identities (email text_pattern_ops);
  CREATE INDEX IF NOT EXISTS mfa_factors_user_id_idx
    ON auth.mfa_factors USING btree (user_id);
END $$;

-- A complete users table alone is not enough: signup also creates an identity,
-- factor relation, and audit record. Normalize ownership for all GoTrue tables.
DO $$
DECLARE auth_table record;
BEGIN
  FOR auth_table IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'auth'
  LOOP
    EXECUTE format('ALTER TABLE auth.%I OWNER TO supabase_auth_admin', auth_table.tablename);
  END LOOP;
END $$;
