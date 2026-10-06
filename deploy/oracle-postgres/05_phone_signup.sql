-- Multi-user sign-in with phone + Telegram OTP.
-- Safe to re-run. Does NOT touch the admin account, rules or channels.
-- Apply: sudo -u postgres psql -d forwardflow -f deploy/oracle-postgres/05_phone_signup.sql

CREATE OR REPLACE FUNCTION public.find_or_create_phone_user(_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _digits text := regexp_replace(_phone, '[^0-9]', '', 'g');
  _uid uuid;
BEGIN
  IF length(_digits) < 7 THEN
    RAISE EXCEPTION 'invalid phone';
  END IF;

  -- 1) Someone already connected this Telegram number -> same account.
  SELECT user_id INTO _uid FROM public.telegram_sessions
   WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = _digits
   ORDER BY (status = 'logged_in') DESC, updated_at DESC
   LIMIT 1;
  IF _uid IS NOT NULL THEN RETURN _uid; END IF;

  -- 2) Existing phone account.
  SELECT id INTO _uid FROM auth.users
   WHERE regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = _digits
   LIMIT 1;
  IF _uid IS NOT NULL THEN RETURN _uid; END IF;

  -- 3) New account (signup triggers add profile, role and 3-day trial).
  _uid := gen_random_uuid();
  INSERT INTO auth.users (id, instance_id, aud, role, phone, phone_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          _digits, now(), '{"provider":"phone","providers":["phone"]}'::jsonb,
          jsonb_build_object('display_name', '+' || _digits), now(), now());

  -- Belt and braces in case the triggers are missing on this server.
  INSERT INTO public.profiles (id, display_name) VALUES (_uid, '+' || _digits)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'user')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.subscriptions (user_id, plan, trial_ends_at, is_active)
    VALUES (_uid, 'trial', now() + interval '3 days', true)
    ON CONFLICT (user_id) DO NOTHING;
  IF to_regclass('public.wallets') IS NOT NULL THEN
    EXECUTE 'INSERT INTO public.wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING' USING _uid;
  END IF;

  RETURN _uid;
END;
$$;

REVOKE ALL ON FUNCTION public.find_or_create_phone_user(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_or_create_phone_user(text) TO service_role;

NOTIFY pgrst, 'reload schema';
