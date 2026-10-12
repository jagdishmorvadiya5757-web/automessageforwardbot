-- Profile fields + admin blocking. Safe to re-run.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- Users must not be able to unblock themselves through the API.
REVOKE UPDATE (is_blocked, blocked_reason) ON public.profiles FROM authenticated;
