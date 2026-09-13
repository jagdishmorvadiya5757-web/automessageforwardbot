-- Backfill history forward + "only video with caption" filter.
-- Safe to run multiple times.
ALTER TABLE public.forwarding_rules
  ADD COLUMN IF NOT EXISTS only_video_with_caption boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backfill_from date,
  ADD COLUMN IF NOT EXISTS backfill_to date,
  ADD COLUMN IF NOT EXISTS backfill_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS backfill_done_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS backfill_detail text;

NOTIFY pgrst, 'reload schema';
