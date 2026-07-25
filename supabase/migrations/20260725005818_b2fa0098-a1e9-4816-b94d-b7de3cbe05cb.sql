ALTER TABLE public.lives
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_generation integer NOT NULL DEFAULT 0;