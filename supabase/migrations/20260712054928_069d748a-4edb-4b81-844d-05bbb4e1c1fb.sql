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