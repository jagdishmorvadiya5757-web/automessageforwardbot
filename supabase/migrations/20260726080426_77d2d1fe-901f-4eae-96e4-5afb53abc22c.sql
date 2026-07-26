
-- 1. Make the single existing user (you) an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('39322125-b240-4ff9-a811-570d4d5f7ff4', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Subscriptions table
CREATE TYPE public.subscription_plan AS ENUM ('trial', 'pro', 'business', 'expired');

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan public.subscription_plan NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  subscription_ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Auto-create trial on signup — extend existing handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  INSERT INTO public.subscriptions (user_id, plan, trial_ends_at, is_active)
  VALUES (NEW.id, 'trial', now() + interval '3 days', true)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Attach trigger if it doesn't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- 4. Backfill subscription for existing user(s)
INSERT INTO public.subscriptions (user_id, plan, trial_ends_at, is_active)
SELECT id, 'trial', now() + interval '3 days', true FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 5. Function to check if user has an active subscription (used by worker & UI)
CREATE OR REPLACE FUNCTION public.is_subscription_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = _user_id
      AND is_active = true
      AND (
        (plan = 'trial' AND trial_ends_at > now())
        OR (plan IN ('pro','business') AND (subscription_ends_at IS NULL OR subscription_ends_at > now()))
      )
  )
$$;

-- 6. telegram_sessions table (server-only, encrypted session strings)
CREATE TABLE public.telegram_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  session_ciphertext text,
  phone text,
  status text NOT NULL DEFAULT 'logged_out',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No anon/authenticated grants — service_role only (session leak = account hijack)
GRANT ALL ON public.telegram_sessions TO service_role;
ALTER TABLE public.telegram_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_telegram_sessions_updated_at
  BEFORE UPDATE ON public.telegram_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
