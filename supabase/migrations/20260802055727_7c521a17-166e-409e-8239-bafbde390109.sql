REVOKE EXECUTE ON FUNCTION public.award_credits(uuid, integer, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.daily_checkin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.redeem_referral(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_credits(uuid, integer, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_credits(uuid, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.daily_checkin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.redeem_referral(uuid, text) TO service_role;