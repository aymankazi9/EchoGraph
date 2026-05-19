-- User preference columns for settings page.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS silence_threshold_ms integer NOT NULL DEFAULT 1500,
  ADD COLUMN IF NOT EXISTS updated_at            timestamptz NOT NULL DEFAULT now();
