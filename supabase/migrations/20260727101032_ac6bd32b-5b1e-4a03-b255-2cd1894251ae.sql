REVOKE ALL ON FUNCTION public.redeem_license_key(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_license_key(text, uuid) TO service_role;