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