-- Admin tools: announcements (broadcast), maintenance mode, audit log, log cleanup. Safe to re-run.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT 'info',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  admin_id UUID,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
GRANT ALL ON public.admin_audit_log TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.admin_audit_log_id_seq TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Deletes forwarding logs older than N days. Called by the app at most every 6h.
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(_days INT DEFAULT 30)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n INT;
BEGIN
  DELETE FROM public.forwarding_logs WHERE created_at < now() - make_interval(days => _days);
  GET DIAGNOSTICS n = ROW_COUNT;
  DELETE FROM public.admin_audit_log WHERE created_at < now() - interval '180 days';
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_old_logs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_old_logs(INT) TO service_role;
