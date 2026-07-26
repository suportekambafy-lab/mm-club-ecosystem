ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS replay_notified_at timestamptz;