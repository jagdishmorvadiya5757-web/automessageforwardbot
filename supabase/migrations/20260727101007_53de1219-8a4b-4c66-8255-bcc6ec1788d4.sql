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