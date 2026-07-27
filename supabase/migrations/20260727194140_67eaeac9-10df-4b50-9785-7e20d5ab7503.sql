ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS guest_token text;
CREATE UNIQUE INDEX IF NOT EXISTS lives_guest_token_key ON public.lives (guest_token) WHERE guest_token IS NOT NULL;