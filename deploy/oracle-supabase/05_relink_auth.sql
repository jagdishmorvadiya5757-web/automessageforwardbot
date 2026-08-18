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
-- If an older repair already removed auth.users before the backup was made,
-- reconstruct every app foreign key from the canonical schema. NOT VALID
-- preserves imported rows whose old hosted-auth users are not in Oracle yet,
-- while still enforcing the relationship for every new write.
INSERT INTO public._auth_fk_backup (table_schema, table_name, constraint_name, definition)
VALUES
  ('public', 'profiles', 'profiles_id_fkey', 'FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'user_roles', 'user_roles_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'forwarding_rules', 'forwarding_rules_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'forwarding_logs', 'forwarding_logs_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'worker_tokens', 'worker_tokens_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'subscriptions', 'subscriptions_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'telegram_sessions', 'telegram_sessions_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'wallets', 'wallets_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'credit_transactions', 'credit_transactions_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'daily_checkins', 'daily_checkins_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'referrals', 'referrals_referrer_id_fkey', 'FOREIGN KEY (referrer_id) REFERENCES auth.users(id) ON DELETE CASCADE'),
  ('public', 'referrals', 'referrals_referred_id_fkey', 'FOREIGN KEY (referred_id) REFERENCES auth.users(id) ON DELETE CASCADE')
ON CONFLICT DO NOTHING;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM public._auth_fk_backup LOOP
    IF to_regclass(format('%I.%I', r.table_schema, r.table_name)) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pg_constraint
         WHERE conname = r.constraint_name
           AND conrelid = to_regclass(format('%I.%I', r.table_schema, r.table_name))
       ) THEN
      -- Old public rows may belong to users from the previous hosted auth
      -- system. NOT VALID preserves those rows while enforcing the FK for all
      -- new Oracle-auth users and writes.
      EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s NOT VALID',
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
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_auth_admin IN SCHEMA auth
  GRANT ALL ON TABLES TO service_role;

DROP TABLE IF EXISTS public._auth_fk_backup;
