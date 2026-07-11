REVOKE EXECUTE ON FUNCTION public.record_forwarded_count(uuid, uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.record_forwarded_count(uuid, uuid) TO service_role;