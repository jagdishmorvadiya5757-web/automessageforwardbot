ALTER TABLE public.forwarding_rules
  ADD COLUMN forward_delay numeric NOT NULL DEFAULT 0
  CHECK (forward_delay >= 0 AND forward_delay <= 3600);