ALTER TABLE public.mm_partner_accounts
  ADD COLUMN IF NOT EXISTS application_note text,
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS decided_by uuid,
  ADD COLUMN IF NOT EXISTS decision_note text;

ALTER TABLE public.mm_partner_accounts ALTER COLUMN status SET DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS mm_partner_accounts_status_idx
  ON public.mm_partner_accounts (status, requested_at DESC);