ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS replay_trim_start_seconds numeric,
  ADD COLUMN IF NOT EXISTS replay_trim_end_seconds numeric;