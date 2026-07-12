REVOKE ALL ON FUNCTION public.record_forwarded_count(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.count_forwarded_log_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_forwarded_count(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_forwarding_slot(uuid, uuid) TO service_role;