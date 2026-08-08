-- Auto-generated bootstrap: all Lovable Cloud migrations concatenated.

-- ===== 20260701120830_b7608294-480d-4ce0-9bb3-1f7865450f6b.sql =====

-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.endpoint_type AS ENUM ('channel', 'bot');
CREATE TYPE public.forward_status AS ENUM ('forwarded', 'skipped', 'error');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- FORWARDING RULES
CREATE TABLE public.forwarding_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  source TEXT NOT NULL,
  source_type endpoint_type NOT NULL DEFAULT 'channel',
  destination TEXT NOT NULL,
  destination_type endpoint_type NOT NULL DEFAULT 'channel',
  enabled BOOLEAN NOT NULL DEFAULT true,
  include_keywords TEXT[] NOT NULL DEFAULT '{}',
  exclude_keywords TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forwarding_rules TO authenticated;
GRANT ALL ON public.forwarding_rules TO service_role;
ALTER TABLE public.forwarding_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rules" ON public.forwarding_rules FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_rules_updated BEFORE UPDATE ON public.forwarding_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_rules_user ON public.forwarding_rules(user_id);

-- FORWARDING LOGS
CREATE TABLE public.forwarding_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.forwarding_rules(id) ON DELETE SET NULL,
  source_msg_ref TEXT,
  status forward_status NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forwarding_logs TO authenticated;
GRANT ALL ON public.forwarding_logs TO service_role;
ALTER TABLE public.forwarding_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own logs" ON public.forwarding_logs FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_logs_user ON public.forwarding_logs(user_id, created_at DESC);

-- WORKER TOKENS
CREATE TABLE public.worker_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_preview TEXT,
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.worker_tokens TO authenticated;
GRANT ALL ON public.worker_tokens TO service_role;
ALTER TABLE public.worker_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own worker token" ON public.worker_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== 20260701120857_48f37298-e243-4ecd-9d8a-b2837c62502a.sql =====

-- Trigger functions should never be callable via the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is used by RLS policies; keep it available to authenticated only
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- ===== 20260701122641_88f0b5f8-626d-4480-8fd6-791f2131b9c5.sql =====
-- Login control-channel state (one row per user)
CREATE TABLE public.telegram_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'logged_out',
  phone text,
  pending_action text,
  code text,
  two_fa_password text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_auth TO authenticated;
GRANT ALL ON public.telegram_auth TO service_role;

ALTER TABLE public.telegram_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own telegram auth"
  ON public.telegram_auth FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_telegram_auth_updated_at
  BEFORE UPDATE ON public.telegram_auth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Synced joined channels/groups/bots
CREATE TABLE public.telegram_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  chat_id text NOT NULL,
  title text NOT NULL,
  username text,
  kind text NOT NULL DEFAULT 'channel',
  can_post boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_channels TO authenticated;
GRANT ALL ON public.telegram_channels TO service_role;

ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own channels"
  ON public.telegram_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_telegram_channels_updated_at
  BEFORE UPDATE ON public.telegram_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- ===== 20260701122733_bee7c3cc-ad26-4ebe-93de-28ddfa2e0852.sql =====
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, authenticated, anon;
-- ===== 20260711131059_2d89b004-f6ed-4e7e-b5ed-23b05b2c2776.sql =====
ALTER TABLE public.forwarding_rules
  ADD COLUMN IF NOT EXISTS max_forward_count integer,
  ADD COLUMN IF NOT EXISTS forwarded_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.forwarding_rules
  ADD CONSTRAINT forwarding_rules_max_forward_count_positive
  CHECK (max_forward_count IS NULL OR max_forward_count > 0),
  ADD CONSTRAINT forwarding_rules_forwarded_count_nonnegative
  CHECK (forwarded_count >= 0);

CREATE OR REPLACE FUNCTION public.reserve_forwarding_slot(_rule_id uuid, _user_id uuid)
RETURNS TABLE(allowed boolean, forwarded_count integer, max_forward_count integer, disabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.forwarding_rules%ROWTYPE;
BEGIN
  SELECT * INTO _row
  FROM public.forwarding_rules
  WHERE id = _rule_id
    AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::integer, false;
    RETURN;
  END IF;

  IF NOT _row.enabled THEN
    RETURN QUERY SELECT false, _row.forwarded_count, _row.max_forward_count, false;
    RETURN;
  END IF;

  IF _row.max_forward_count IS NOT NULL AND _row.forwarded_count >= _row.max_forward_count THEN
    UPDATE public.forwarding_rules
    SET enabled = false, updated_at = now()
    WHERE id = _rule_id;
    RETURN QUERY SELECT false, _row.forwarded_count, _row.max_forward_count, true;
    RETURN;
  END IF;

  UPDATE public.forwarding_rules
  SET forwarded_count = forwarded_count + 1,
      enabled = CASE
        WHEN max_forward_count IS NOT NULL AND forwarded_count + 1 >= max_forward_count THEN false
        ELSE enabled
      END,
      updated_at = now()
  WHERE id = _rule_id
  RETURNING * INTO _row;

  RETURN QUERY SELECT true, _row.forwarded_count, _row.max_forward_count, NOT _row.enabled;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_forwarding_slot(_rule_id uuid, _user_id uuid)
RETURNS TABLE(forwarded_count integer, enabled boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.forwarding_rules%ROWTYPE;
BEGIN
  UPDATE public.forwarding_rules
  SET forwarded_count = GREATEST(forwarded_count - 1, 0),
      enabled = CASE
        WHEN max_forward_count IS NOT NULL AND forwarded_count <= max_forward_count THEN true
        ELSE enabled
      END,
      updated_at = now()
  WHERE id = _rule_id
    AND user_id = _user_id
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT _row.forwarded_count, _row.enabled;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_forwarding_slot(uuid, uuid) TO service_role;
-- ===== 20260711131117_640b6c9f-df5f-4922-ba93-f1724d3e456f.sql =====
REVOKE ALL ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_forwarding_slot(uuid, uuid) TO service_role;
-- ===== 20260711140652_4742df97-6cd2-4cba-9f8f-dce7bde2cf1c.sql =====
CREATE OR REPLACE FUNCTION public.record_forwarded_count(_rule_id uuid, _user_id uuid)
 RETURNS TABLE(forwarded_count integer, max_forward_count integer, enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.forwarding_rules%ROWTYPE;
BEGIN
  UPDATE public.forwarding_rules
  SET forwarded_count = forwarded_count + 1,
      enabled = CASE
        WHEN max_forward_count IS NOT NULL AND forwarded_count + 1 >= max_forward_count THEN false
        ELSE enabled
      END,
      updated_at = now()
  WHERE id = _rule_id
    AND user_id = _user_id
  RETURNING * INTO _row;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, NULL::integer, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT _row.forwarded_count, _row.max_forward_count, _row.enabled;
END;
$function$;
-- ===== 20260711140714_ab0dd711-3cfb-47a0-9d66-a574c289581e.sql =====
REVOKE EXECUTE ON FUNCTION public.record_forwarded_count(uuid, uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.record_forwarded_count(uuid, uuid) TO service_role;
-- ===== 20260711140757_23478ce9-aec8-4e10-acd3-d2120c0c158b.sql =====
ALTER TYPE public.forward_status ADD VALUE IF NOT EXISTS 'waiting';
-- ===== 20260711140843_4ec6168f-d9ce-4bb7-8376-87a4a5345e1b.sql =====
CREATE OR REPLACE FUNCTION public.reserve_forwarding_slot(_rule_id uuid, _user_id uuid)
 RETURNS TABLE(allowed boolean, forwarded_count integer, max_forward_count integer, disabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.forwarding_rules%ROWTYPE;
BEGIN
  SELECT * INTO _row
  FROM public.forwarding_rules
  WHERE id = _rule_id
    AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::integer, false;
    RETURN;
  END IF;

  IF NOT _row.enabled THEN
    RETURN QUERY SELECT false, _row.forwarded_count, _row.max_forward_count, false;
    RETURN;
  END IF;

  IF _row.max_forward_count IS NOT NULL AND _row.forwarded_count >= _row.max_forward_count THEN
    UPDATE public.forwarding_rules
    SET enabled = false, updated_at = now()
    WHERE id = _rule_id;
    RETURN QUERY SELECT false, _row.forwarded_count, _row.max_forward_count, true;
    RETURN;
  END IF;

  -- Check only; the actual count is incremented in record_forwarded_count
  -- after the message is truly forwarded, so counting lives in one place.
  RETURN QUERY SELECT true, _row.forwarded_count, _row.max_forward_count, false;
END;
$function$;
-- ===== 20260711140911_fd3aeed3-a9e1-4cf7-80e9-636cf52ba98c.sql =====
UPDATE public.forwarding_rules r
SET forwarded_count = sub.cnt,
    updated_at = now()
FROM (
  SELECT rule_id, COUNT(*)::int AS cnt
  FROM public.forwarding_logs
  WHERE status = 'forwarded' AND rule_id IS NOT NULL
  GROUP BY rule_id
) sub
WHERE r.id = sub.rule_id;
-- ===== 20260711181507_a1274511-913e-45d2-81cf-3bf0f6b20f31.sql =====
ALTER TABLE public.forwarding_rules
  ADD COLUMN forward_delay numeric NOT NULL DEFAULT 0
  CHECK (forward_delay >= 0 AND forward_delay <= 3600);
-- ===== 20260712054928_069d748a-4edb-4b81-844d-05bbb4e1c1fb.sql =====
CREATE OR REPLACE FUNCTION public.record_forwarded_count(_rule_id uuid, _user_id uuid)
 RETURNS TABLE(forwarded_count integer, max_forward_count integer, enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.forwarding_rules%ROWTYPE;
BEGIN
  SELECT * INTO _row
  FROM public.forwarding_rules
  WHERE id = _rule_id
    AND user_id = _user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, NULL::integer, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT _row.forwarded_count, _row.max_forward_count, _row.enabled;
END;
$function$;

CREATE OR REPLACE FUNCTION public.release_forwarding_slot(_rule_id uuid, _user_id uuid)
 RETURNS TABLE(forwarded_count integer, enabled boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _row public.forwarding_rules%ROWTYPE;
BEGIN
  SELECT * INTO _row
  FROM public.forwarding_rules
  WHERE id = _rule_id
    AND user_id = _user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT _row.forwarded_count, _row.enabled;
END;
$function$;

CREATE OR REPLACE FUNCTION public.count_forwarded_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'forwarded' AND NEW.rule_id IS NOT NULL THEN
    UPDATE public.forwarding_rules
    SET forwarded_count = forwarded_count + 1,
        enabled = CASE
          WHEN max_forward_count IS NOT NULL AND forwarded_count + 1 >= max_forward_count THEN false
          ELSE enabled
        END,
        updated_at = now()
    WHERE id = NEW.rule_id
      AND user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS count_forwarded_log_insert_trigger ON public.forwarding_logs;
CREATE TRIGGER count_forwarded_log_insert_trigger
AFTER INSERT ON public.forwarding_logs
FOR EACH ROW
EXECUTE FUNCTION public.count_forwarded_log_insert();

WITH counts AS (
  SELECT rule_id, user_id, count(*)::integer AS forwarded_total
  FROM public.forwarding_logs
  WHERE status = 'forwarded'
    AND rule_id IS NOT NULL
  GROUP BY rule_id, user_id
)
UPDATE public.forwarding_rules r
SET forwarded_count = COALESCE(c.forwarded_total, 0),
    enabled = CASE
      WHEN r.max_forward_count IS NOT NULL AND COALESCE(c.forwarded_total, 0) >= r.max_forward_count THEN false
      ELSE r.enabled
    END,
    updated_at = now()
FROM counts c
WHERE r.id = c.rule_id
  AND r.user_id = c.user_id;

UPDATE public.forwarding_rules r
SET forwarded_count = 0,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM public.forwarding_logs l
  WHERE l.rule_id = r.id
    AND l.user_id = r.user_id
    AND l.status = 'forwarded'
);
-- ===== 20260712054943_73fd4ce4-5c61-4aba-af40-9494882bd201.sql =====
REVOKE ALL ON FUNCTION public.record_forwarded_count(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_forwarded_log_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_forwarded_count(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_forwarding_slot(uuid, uuid) TO service_role;
-- ===== 20260726080426_77d2d1fe-901f-4eae-96e4-5afb53abc22c.sql =====

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

-- ===== 20260726080444_9f60bc83-660c-42e0-a659-1b423a83a8d4.sql =====

-- Deny-all policy on telegram_sessions so RLS is active with no accidental exposure
CREATE POLICY "No client access" ON public.telegram_sessions FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- Restrict is_subscription_active to service role only (not exposed publicly)
REVOKE EXECUTE ON FUNCTION public.is_subscription_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_subscription_active(uuid) TO service_role;

-- ===== 20260727101007_53de1219-8a4b-4c66-8255-bcc6ec1788d4.sql =====
CREATE TABLE public.license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan public.subscription_plan NOT NULL DEFAULT 'pro',
  duration_days integer NOT NULL DEFAULT 30,
  note text,
  created_by uuid,
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_keys TO authenticated;
GRANT ALL ON public.license_keys TO service_role;

ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage license keys"
ON public.license_keys FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_license_keys_updated_at
BEFORE UPDATE ON public.license_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_license_keys_redeemed_by ON public.license_keys(redeemed_by);

CREATE OR REPLACE FUNCTION public.redeem_license_key(_code text, _user_id uuid)
RETURNS TABLE(success boolean, message text, plan public.subscription_plan, ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key public.license_keys%ROWTYPE;
  _base timestamptz;
  _new_end timestamptz;
BEGIN
  SELECT * INTO _key FROM public.license_keys
  WHERE upper(code) = upper(trim(_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid license key', NULL::public.subscription_plan, NULL::timestamptz;
    RETURN;
  END IF;

  IF _key.redeemed_by IS NOT NULL THEN
    RETURN QUERY SELECT false, 'This key has already been used', NULL::public.subscription_plan, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT GREATEST(now(), COALESCE(s.subscription_ends_at, now()))
    INTO _base
  FROM public.subscriptions s WHERE s.user_id = _user_id;

  IF _base IS NULL THEN _base := now(); END IF;
  _new_end := _base + (_key.duration_days || ' days')::interval;

  INSERT INTO public.subscriptions (user_id, plan, subscription_ends_at, is_active)
  VALUES (_user_id, _key.plan, _new_end, true)
  ON CONFLICT (user_id) DO UPDATE
    SET plan = _key.plan,
        subscription_ends_at = _new_end,
        is_active = true,
        updated_at = now();

  UPDATE public.license_keys
    SET redeemed_by = _user_id, redeemed_at = now(), updated_at = now()
  WHERE id = _key.id;

  RETURN QUERY SELECT true, 'License activated', _key.plan, _new_end;
END;
$$;
-- ===== 20260727101032_ac6bd32b-5b1e-4a03-b255-2cd1894251ae.sql =====
REVOKE ALL ON FUNCTION public.redeem_license_key(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_license_key(text, uuid) TO service_role;
-- ===== 20260728083141_b53af00d-5f7e-4233-95e3-be7058d83f89.sql =====
ALTER TABLE public.telegram_auth
ADD COLUMN IF NOT EXISTS phone_code_hash text;
-- ===== 20260729062529_0cf4c946-4f8c-4a4c-a472-b1ea2964c200.sql =====

CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  price text NOT NULL DEFAULT '',
  period text NOT NULL DEFAULT '',
  perks text[] NOT NULL DEFAULT '{}',
  duration_days integer NOT NULL DEFAULT 30,
  payment_link text,
  plan public.subscription_plan NOT NULL DEFAULT 'pro',
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view plans" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Admins manage plans" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plans (slug, name, price, period, perks, duration_days, plan, sort_order) VALUES
 ('pro', 'Pro', '₹499', 'per month', ARRAY['Unlimited forwarding','Per-rule delay & limits','Priority worker'], 30, 'pro', 1),
 ('business', 'Business', '₹1499', 'per month', ARRAY['Everything in Pro','Multiple Telegram accounts','Priority support'], 30, 'business', 2);

CREATE TABLE public.claim_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan public.subscription_plan NOT NULL DEFAULT 'pro',
  duration_days integer NOT NULL DEFAULT 30,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.claim_codes TO service_role;
ALTER TABLE public.claim_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage claim codes" ON public.claim_codes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER claim_codes_updated_at BEFORE UPDATE ON public.claim_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.claim_license_key(_code text)
RETURNS TABLE(success boolean, message text, license_code text, plan public.subscription_plan, duration_days integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cc public.claim_codes%ROWTYPE;
  _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _key text;
  _i int;
BEGIN
  SELECT * INTO _cc FROM public.claim_codes
   WHERE upper(code) = upper(trim(_code)) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid claim code', NULL::text, NULL::public.subscription_plan, NULL::integer;
    RETURN;
  END IF;

  IF NOT _cc.active OR _cc.used_count >= _cc.max_uses THEN
    RETURN QUERY SELECT false, 'This claim code has already been used', NULL::text, NULL::public.subscription_plan, NULL::integer;
    RETURN;
  END IF;

  LOOP
    _key := 'FF';
    FOR _i IN 1..3 LOOP
      _key := _key || '-' ||
        substr(_alphabet, 1 + floor(random()*32)::int, 1) ||
        substr(_alphabet, 1 + floor(random()*32)::int, 1) ||
        substr(_alphabet, 1 + floor(random()*32)::int, 1) ||
        substr(_alphabet, 1 + floor(random()*32)::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.license_keys lk WHERE lk.code = _key);
  END LOOP;

  INSERT INTO public.license_keys (code, plan, duration_days, note)
  VALUES (_key, _cc.plan, _cc.duration_days, 'Auto-issued via claim code ' || _cc.code);

  UPDATE public.claim_codes SET used_count = used_count + 1,
    active = CASE WHEN used_count + 1 >= max_uses THEN false ELSE active END,
    updated_at = now()
  WHERE id = _cc.id;

  RETURN QUERY SELECT true, 'License key generated', _key, _cc.plan, _cc.duration_days;
END;
$$;

-- ===== 20260729062552_68355e8f-3598-4ea4-92aa-aa0f0bf0067c.sql =====
REVOKE EXECUTE ON FUNCTION public.claim_license_key(text) FROM anon, authenticated, public;
-- ===== 20260802055702_7744a4a2-866e-483a-b5ca-e341e821c74d.sql =====
-- ============ WALLETS ============
CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own wallet" ON public.wallets FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  kind text NOT NULL,
  note text,
  counterparty_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX credit_tx_user_idx ON public.credit_transactions (user_id, created_at DESC);
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT ALL ON public.credit_transactions TO service_role;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own transactions" ON public.credit_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ CHECK-INS ============
CREATE TABLE public.daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  streak integer NOT NULL DEFAULT 1,
  credits_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own checkins" ON public.daily_checkins FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ============ REFERRALS ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX referrals_referrer_idx ON public.referrals (referrer_id);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own referrals" ON public.referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id OR public.has_role(auth.uid(), 'admin'));

-- ============ RULE MODIFIERS ============
ALTER TABLE public.forwarding_rules
  ADD COLUMN IF NOT EXISTS header_text text,
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS replacements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sender_whitelist text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS sender_blacklist text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS strip_forward_tag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crypto_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_rewrite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS translate_to text,
  ADD COLUMN IF NOT EXISTS auto_join boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS block_media boolean NOT NULL DEFAULT false;

-- ============ WORKER HEALTH ============
CREATE TABLE public.worker_health (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_heartbeat timestamptz,
  version text,
  active_clients integer NOT NULL DEFAULT 0,
  queued_messages integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  detail text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.worker_health TO authenticated;
GRANT ALL ON public.worker_health TO service_role;
ALTER TABLE public.worker_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view worker health" ON public.worker_health FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.worker_health (id) VALUES (1);

-- ============ CREDIT FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.award_credits(_user_id uuid, _amount integer, _kind text, _note text DEFAULT NULL, _counterparty uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal integer;
BEGIN
  INSERT INTO public.wallets (user_id, balance, lifetime_earned)
  VALUES (_user_id, GREATEST(_amount, 0), GREATEST(_amount, 0))
  ON CONFLICT (user_id) DO UPDATE
    SET balance = GREATEST(0, public.wallets.balance + _amount),
        lifetime_earned = public.wallets.lifetime_earned + GREATEST(_amount, 0),
        updated_at = now()
  RETURNING balance INTO _bal;

  INSERT INTO public.credit_transactions (user_id, amount, kind, note, counterparty_id)
  VALUES (_user_id, _amount, _kind, _note, _counterparty);

  RETURN _bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_credits(_from uuid, _to uuid, _amount integer, _note text DEFAULT NULL)
RETURNS TABLE(success boolean, message text, balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _bal integer;
BEGIN
  IF _amount <= 0 THEN
    RETURN QUERY SELECT false, 'Amount must be positive', NULL::integer; RETURN;
  END IF;
  IF _from = _to THEN
    RETURN QUERY SELECT false, 'Cannot transfer to yourself', NULL::integer; RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _to) THEN
    RETURN QUERY SELECT false, 'Recipient not found', NULL::integer; RETURN;
  END IF;

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _from FOR UPDATE;
  IF _bal IS NULL OR _bal < _amount THEN
    RETURN QUERY SELECT false, 'Not enough credits', COALESCE(_bal, 0); RETURN;
  END IF;

  PERFORM public.award_credits(_from, -_amount, 'transfer_out', _note, _to);
  PERFORM public.award_credits(_to, _amount, 'transfer_in', _note, _from);

  SELECT balance INTO _bal FROM public.wallets WHERE user_id = _from;
  RETURN QUERY SELECT true, 'Transferred', _bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.daily_checkin(_user_id uuid)
RETURNS TABLE(success boolean, message text, streak integer, credits integer, balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _today date := (now() AT TIME ZONE 'utc')::date;
        _prev public.daily_checkins%ROWTYPE;
        _streak integer := 1;
        _award integer;
        _bal integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.daily_checkins WHERE user_id = _user_id AND day = _today) THEN
    SELECT * INTO _prev FROM public.daily_checkins WHERE user_id = _user_id AND day = _today;
    SELECT balance INTO _bal FROM public.wallets WHERE user_id = _user_id;
    RETURN QUERY SELECT false, 'Already checked in today', _prev.streak, 0, COALESCE(_bal, 0);
    RETURN;
  END IF;

  SELECT * INTO _prev FROM public.daily_checkins WHERE user_id = _user_id ORDER BY day DESC LIMIT 1;
  IF FOUND AND _prev.day = _today - 1 THEN
    _streak := _prev.streak + 1;
  END IF;

  _award := LEAST(5 + (_streak - 1) * 2, 25);
  INSERT INTO public.daily_checkins (user_id, day, streak, credits_awarded)
  VALUES (_user_id, _today, _streak, _award);

  _bal := public.award_credits(_user_id, _award, 'checkin', 'Daily check-in day ' || _streak);
  RETURN QUERY SELECT true, 'Checked in', _streak, _award, _bal;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_referral(_referred uuid, _code text)
RETURNS TABLE(success boolean, message text, credits integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _referrer uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = _referred) THEN
    RETURN QUERY SELECT false, 'You already used a referral code', 0; RETURN;
  END IF;
  SELECT id INTO _referrer FROM public.profiles WHERE upper(referral_code) = upper(trim(_code));
  IF _referrer IS NULL THEN
    RETURN QUERY SELECT false, 'Invalid referral code', 0; RETURN;
  END IF;
  IF _referrer = _referred THEN
    RETURN QUERY SELECT false, 'You cannot refer yourself', 0; RETURN;
  END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, credits_awarded) VALUES (_referrer, _referred, 50);
  PERFORM public.award_credits(_referrer, 50, 'referral', 'Referral bonus');
  PERFORM public.award_credits(_referred, 25, 'referral_signup', 'Signed up with a referral code');
  RETURN QUERY SELECT true, 'Referral applied', 25;
END;
$$;

-- Referral code + wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text;
BEGIN
  _code := 'FF' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  INSERT INTO public.profiles (id, display_name, referral_code)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), _code);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  INSERT INTO public.subscriptions (user_id, plan, trial_ends_at, is_active)
  VALUES (NEW.id, 'trial', now() + interval '3 days', true)
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Backfill existing users
INSERT INTO public.wallets (user_id) SELECT id FROM public.profiles ON CONFLICT DO NOTHING;
UPDATE public.profiles
SET referral_code = 'FF' || upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE referral_code IS NULL;
-- ===== 20260802055727_7c521a17-166e-409e-8239-bafbde390109.sql =====
REVOKE EXECUTE ON FUNCTION public.award_credits(uuid, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.daily_checkin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_referral(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_credits(uuid, integer, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.daily_checkin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_referral(uuid, text) TO service_role;
