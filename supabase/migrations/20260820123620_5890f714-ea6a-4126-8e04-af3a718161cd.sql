CREATE UNIQUE INDEX IF NOT EXISTS billing_dunning_attempts_idempotency_key_uidx
  ON public.billing_dunning_attempts (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_dunning_attempts_due_idx
  ON public.billing_dunning_attempts (status, scheduled_for);

CREATE INDEX IF NOT EXISTS billing_dunning_attempts_cycle_idx
  ON public.billing_dunning_attempts (cycle_key);