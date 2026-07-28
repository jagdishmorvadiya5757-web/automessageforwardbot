ALTER TABLE public.telegram_auth
ADD COLUMN IF NOT EXISTS phone_code_hash text;