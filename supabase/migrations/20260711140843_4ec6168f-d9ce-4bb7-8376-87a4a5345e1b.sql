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