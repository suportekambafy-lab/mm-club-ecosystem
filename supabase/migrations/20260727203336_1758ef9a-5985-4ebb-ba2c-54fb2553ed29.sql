ALTER TABLE public.live_participants
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Fecha participantes fantasma antigos (sem sinal de vida)
UPDATE public.live_participants
SET left_at = now()
WHERE left_at IS NULL
  AND COALESCE(last_seen_at, joined_at, created_at) < now() - interval '5 minutes';