-- Paid plans (Premium / Premium Pro), media filter, referral +3 days,
-- Razorpay auto-activation. Safe to run multiple times.
-- Apply: sudo -u postgres psql -d forwardflow -f deploy/oracle-postgres/08_paid_plans.sql

-- 1) Rule columns
ALTER TABLE public.forwarding_rules
  ADD COLUMN IF NOT EXISTS header_text text,
  ADD COLUMN IF NOT EXISTS footer_text text,
  ADD COLUMN IF NOT EXISTS replacements jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS media_filter text NOT NULL DEFAULT 'all';

-- 2) Plan catalogue ("pro" enum = Premium, "business" enum = Premium Pro)
DELETE FROM public.plans WHERE slug IN ('pro', 'business');
INSERT INTO public.plans (slug, name, price, period, perks, duration_days, plan, sort_order) VALUES
 ('premium-monthly', 'Premium', '₹99', 'per month',
   ARRAY['10 forwarding rules','Allow / block words','Media filters','Delay & auto-stop counter'], 30, 'pro', 1),
 ('premium-pro-monthly', 'Premium Pro', '₹319', 'per month',
   ARRAY['25 forwarding rules','Header & footer text','Link replace','Old posts (backfill)','Schedule mode','Dedicated support'], 30, 'business', 2),
 ('premium-yearly', 'Premium Yearly', '₹999', 'per year',
   ARRAY['Everything in Premium','365 days'], 365, 'pro', 3),
 ('premium-pro-yearly', 'Premium Pro Yearly', '₹2999', 'per year',
   ARRAY['Everything in Premium Pro','365 days'], 365, 'business', 4)
ON CONFLICT (slug) DO NOTHING;

-- 3) Extend a user's plan from max(now, current end)
CREATE OR REPLACE FUNCTION public.extend_subscription(_user uuid, _plan subscription_plan, _days integer)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _cur public.subscriptions; _base timestamptz; _new_plan subscription_plan; _end timestamptz;
BEGIN
  SELECT * INTO _cur FROM public.subscriptions WHERE user_id = _user;
  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, plan, subscription_ends_at, is_active)
    VALUES (_user, _plan, now() + make_interval(days => _days), true);
    RETURN now() + make_interval(days => _days);
  END IF;
  IF _cur.plan IN ('pro','business') AND _cur.subscription_ends_at > now() THEN
    _base := _cur.subscription_ends_at;
  ELSIF _cur.plan = 'trial' AND _cur.trial_ends_at > now() THEN
    _base := _cur.trial_ends_at;
  ELSE
    _base := now();
  END IF;
  -- never downgrade an active Premium Pro to Premium
  _new_plan := CASE WHEN _cur.plan = 'business' AND _cur.subscription_ends_at > now() THEN 'business' ELSE _plan END;
  _end := _base + make_interval(days => _days);
  UPDATE public.subscriptions
     SET plan = _new_plan, subscription_ends_at = _end, is_active = true, updated_at = now()
   WHERE user_id = _user;
  RETURN _end;
END; $$;

-- 4) Referral: friend joins -> referrer +3 days
CREATE OR REPLACE FUNCTION public.redeem_referral(_referred uuid, _code text)
RETURNS TABLE(success boolean, message text, credits integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _referrer uuid; _sub public.subscriptions;
BEGIN
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_id = _referred) THEN
    RETURN QUERY SELECT false, 'You already used a referral code', 0; RETURN;
  END IF;
  SELECT id INTO _referrer FROM public.profiles WHERE upper(referral_code) = upper(trim(_code));
  IF _referrer IS NULL THEN RETURN QUERY SELECT false, 'Invalid referral code', 0; RETURN; END IF;
  IF _referrer = _referred THEN RETURN QUERY SELECT false, 'You cannot refer yourself', 0; RETURN; END IF;

  INSERT INTO public.referrals (referrer_id, referred_id, credits_awarded) VALUES (_referrer, _referred, 50);
  PERFORM public.award_credits(_referrer, 50, 'referral', 'Referral bonus');
  PERFORM public.award_credits(_referred, 25, 'referral_signup', 'Signed up with a referral code');

  SELECT * INTO _sub FROM public.subscriptions WHERE user_id = _referrer;
  IF FOUND AND _sub.plan = 'trial' THEN
    UPDATE public.subscriptions
       SET trial_ends_at = greatest(trial_ends_at, now()) + interval '3 days', is_active = true, updated_at = now()
     WHERE user_id = _referrer;
  ELSE
    PERFORM public.extend_subscription(_referrer, coalesce(NULLIF(_sub.plan, 'expired'), 'pro'), 3);
  END IF;
  RETURN QUERY SELECT true, 'Referral applied — your friend got +3 days', 25;
END; $$;

-- 5) Razorpay payments (idempotent per payment id)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id text PRIMARY KEY,
  user_id uuid,
  phone text,
  amount_paise integer,
  plan subscription_plan,
  days integer,
  status text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins view payments" ON public.payment_events;
CREATE POLICY "Admins view payments" ON public.payment_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.payment_events TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_paid_plan(
  _event_id text, _phone text, _plan subscription_plan, _days integer, _amount integer, _raw jsonb)
RETURNS TABLE(success boolean, message text, user_id uuid, ends_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE _digits text := right(regexp_replace(coalesce(_phone,''), '[^0-9]', '', 'g'), 10);
        _uid uuid; _end timestamptz; _first boolean; _referrer uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.payment_events WHERE id = _event_id) THEN
    RETURN QUERY SELECT true, 'already processed', NULL::uuid, NULL::timestamptz; RETURN;
  END IF;
  IF length(_digits) = 10 THEN
    SELECT s.user_id INTO _uid FROM public.telegram_sessions s
     WHERE right(regexp_replace(coalesce(s.phone,''), '[^0-9]', '', 'g'), 10) = _digits
     ORDER BY s.updated_at DESC LIMIT 1;
    IF _uid IS NULL THEN
      SELECT u.id INTO _uid FROM auth.users u
       WHERE right(regexp_replace(coalesce(u.phone,''), '[^0-9]', '', 'g'), 10) = _digits LIMIT 1;
    END IF;
  END IF;
  IF _uid IS NULL THEN
    INSERT INTO public.payment_events (id, phone, amount_paise, plan, days, status, raw)
    VALUES (_event_id, _phone, _amount, _plan, _days, 'no_user', _raw);
    RETURN QUERY SELECT false, 'no account for this phone', NULL::uuid, NULL::timestamptz; RETURN;
  END IF;

  _first := NOT EXISTS (SELECT 1 FROM public.payment_events p WHERE p.user_id = _uid AND p.status = 'activated');
  _end := public.extend_subscription(_uid, _plan, _days);
  INSERT INTO public.payment_events (id, user_id, phone, amount_paise, plan, days, status, raw)
  VALUES (_event_id, _uid, _phone, _amount, _plan, _days, 'activated', _raw);

  -- Friend bought a paid plan -> referrer gets +1 month Premium (first payment only)
  IF _first THEN
    SELECT r.referrer_id INTO _referrer FROM public.referrals r WHERE r.referred_id = _uid;
    IF _referrer IS NOT NULL THEN
      PERFORM public.extend_subscription(_referrer, 'pro', 30);
    END IF;
  END IF;
  RETURN QUERY SELECT true, 'activated', _uid, _end;
END; $$;

REVOKE EXECUTE ON FUNCTION public.extend_subscription(uuid, subscription_plan, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_paid_plan(text, text, subscription_plan, integer, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_subscription(uuid, subscription_plan, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_paid_plan(text, text, subscription_plan, integer, integer, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
