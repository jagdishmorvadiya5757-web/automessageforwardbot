-- Daily limit for phone + Telegram OTP sign-in codes (3 per number per day).
-- Safe to re-run. Does NOT touch the admin account, rules or channels.
-- Apply: sudo -u postgres psql -d forwardflow -f deploy/oracle-postgres/06_phone_login_limit.sql

CREATE TABLE IF NOT EXISTS public.phone_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phone_login_attempts_phone_time
  ON public.phone_login_attempts (phone, created_at DESC);

GRANT ALL ON public.phone_login_attempts TO service_role;
ALTER TABLE public.phone_login_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only the server (service role) reads/writes this table.

NOTIFY pgrst, 'reload schema';
