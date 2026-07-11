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