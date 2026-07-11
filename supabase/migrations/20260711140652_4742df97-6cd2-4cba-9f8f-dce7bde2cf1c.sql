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