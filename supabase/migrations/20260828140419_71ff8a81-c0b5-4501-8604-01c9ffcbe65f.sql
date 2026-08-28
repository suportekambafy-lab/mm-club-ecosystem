ALTER TABLE public.moderation_actions
  ADD COLUMN IF NOT EXISTS snapshot jsonb,
  ADD COLUMN IF NOT EXISTS restored_at timestamptz;