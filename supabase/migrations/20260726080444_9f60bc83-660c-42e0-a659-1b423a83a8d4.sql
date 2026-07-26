
-- Deny-all policy on telegram_sessions so RLS is active with no accidental exposure
CREATE POLICY "No client access" ON public.telegram_sessions FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- Restrict is_subscription_active to service role only (not exposed publicly)
REVOKE EXECUTE ON FUNCTION public.is_subscription_active(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_subscription_active(uuid) TO service_role;
