ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS recording_egress_id text,
  ADD COLUMN IF NOT EXISTS recording_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_filepath text;