-- Optional per-rule schedule (auto on/off by time of day + weekdays).
-- Safe to run multiple times.
ALTER TABLE public.forwarding_rules
  ADD COLUMN IF NOT EXISTS schedule_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS schedule_start text,
  ADD COLUMN IF NOT EXISTS schedule_end text,
  ADD COLUMN IF NOT EXISTS schedule_days integer[] NOT NULL DEFAULT '{}'::integer[],
  ADD COLUMN IF NOT EXISTS schedule_tz_offset integer NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
