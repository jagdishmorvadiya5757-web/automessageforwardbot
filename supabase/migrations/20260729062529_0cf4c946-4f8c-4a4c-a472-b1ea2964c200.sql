
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
