REVOKE ALL ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_forwarding_slot(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.release_forwarding_slot(uuid, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.release_forwarding_slot(uuid, uuid) TO service_role;