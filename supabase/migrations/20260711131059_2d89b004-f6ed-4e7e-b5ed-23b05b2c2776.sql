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