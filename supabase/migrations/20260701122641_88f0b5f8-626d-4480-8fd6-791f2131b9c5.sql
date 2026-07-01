-- Login control-channel state (one row per user)
CREATE TABLE public.telegram_auth (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'logged_out',
  phone text,
  pending_action text,
  code text,
  two_fa_password text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_auth TO authenticated;
GRANT ALL ON public.telegram_auth TO service_role;

ALTER TABLE public.telegram_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own telegram auth"
  ON public.telegram_auth FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_telegram_auth_updated_at
  BEFORE UPDATE ON public.telegram_auth
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Synced joined channels/groups/bots
CREATE TABLE public.telegram_channels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  chat_id text NOT NULL,
  title text NOT NULL,
  username text,
  kind text NOT NULL DEFAULT 'channel',
  can_post boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_channels TO authenticated;
GRANT ALL ON public.telegram_channels TO service_role;

ALTER TABLE public.telegram_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own channels"
  ON public.telegram_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_telegram_channels_updated_at
  BEFORE UPDATE ON public.telegram_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();