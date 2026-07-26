ALTER TABLE public.billing_dunning_attempts
  ADD COLUMN IF NOT EXISTS cycle_key text,
  ADD COLUMN IF NOT EXISTS phase text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled',
  ADD COLUMN IF NOT EXISTS error_category text,
  ADD COLUMN IF NOT EXISTS gateway_error_code text,
  ADD COLUMN IF NOT EXISTS gateway_error_message text,
  ADD COLUMN IF NOT EXISTS recovery_score integer,
  ADD COLUMN IF NOT EXISTS amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS mandate_id text,
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS invoice_id uuid,
  ADD COLUMN IF NOT EXISTS payment_id uuid,
  ADD COLUMN IF NOT EXISTS gateway_payment_id text,
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS billing_dunning_attempts_idem_uniq
  ON public.billing_dunning_attempts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_dunning_attempts_sub_idx
  ON public.billing_dunning_attempts (subscription_id, attempt_number);

CREATE INDEX IF NOT EXISTS billing_dunning_attempts_cycle_idx
  ON public.billing_dunning_attempts (cycle_key);

CREATE INDEX IF NOT EXISTS billing_dunning_attempts_user_idx
  ON public.billing_dunning_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_dunning_attempts_status_idx
  ON public.billing_dunning_attempts (status, scheduled_for);

CREATE INDEX IF NOT EXISTS billing_dunning_attempts_gwpay_idx
  ON public.billing_dunning_attempts (gateway_payment_id)
  WHERE gateway_payment_id IS NOT NULL;

-- ---------------------------------------------------------------- metrics
CREATE OR REPLACE VIEW public.billing_recovery_by_phase
WITH (security_invoker = on) AS
  SELECT
    phase,
    count(*) FILTER (WHERE status IN ('attempted','succeeded','failed')) AS attempts,
    count(*) FILTER (WHERE status = 'succeeded')                        AS recovered,
    coalesce(sum(amount_cents) FILTER (WHERE status = 'succeeded'), 0)  AS recovered_cents,
    avg(EXTRACT(EPOCH FROM (recovered_at - created_at)))
      FILTER (WHERE recovered_at IS NOT NULL)                           AS avg_seconds_to_recover
  FROM public.billing_dunning_attempts
  GROUP BY phase;

CREATE OR REPLACE VIEW public.billing_recovery_by_reason
WITH (security_invoker = on) AS
  SELECT
    coalesce(error_category, 'unknown') AS error_category,
    coalesce(gateway_error_code, 'unknown') AS gateway_error_code,
    count(*) AS attempts,
    count(*) FILTER (WHERE status = 'succeeded') AS recovered
  FROM public.billing_dunning_attempts
  GROUP BY 1, 2;

CREATE OR REPLACE VIEW public.billing_recovery_by_method
WITH (security_invoker = on) AS
  SELECT
    coalesce(method, 'unknown') AS method,
    count(*) FILTER (WHERE status IN ('attempted','succeeded','failed')) AS attempts,
    count(*) FILTER (WHERE status = 'succeeded') AS recovered,
    coalesce(sum(amount_cents) FILTER (WHERE status = 'succeeded'), 0) AS recovered_cents
  FROM public.billing_dunning_attempts
  GROUP BY 1;

REVOKE ALL ON public.billing_recovery_by_phase FROM anon, authenticated;
REVOKE ALL ON public.billing_recovery_by_reason FROM anon, authenticated;
REVOKE ALL ON public.billing_recovery_by_method FROM anon, authenticated;
GRANT SELECT ON public.billing_recovery_by_phase TO service_role;
GRANT SELECT ON public.billing_recovery_by_reason TO service_role;
GRANT SELECT ON public.billing_recovery_by_method TO service_role;