CREATE TABLE public.billing_customer_profiles (
  user_id uuid PRIMARY KEY,
  customer_since timestamptz,
  months_as_customer numeric NOT NULL DEFAULT 0,
  invoices_total integer NOT NULL DEFAULT 0,
  payments_succeeded integer NOT NULL DEFAULT 0,
  payments_failed integer NOT NULL DEFAULT 0,
  consecutive_successes integer NOT NULL DEFAULT 0,
  recoveries_succeeded integer NOT NULL DEFAULT 0,
  recoveries_failed integer NOT NULL DEFAULT 0,
  recovery_rate numeric NOT NULL DEFAULT 0,
  avg_hours_to_recover numeric,
  avg_days_failure_to_payment numeric,
  chargebacks integer NOT NULL DEFAULT 0,
  refunds integer NOT NULL DEFAULT 0,
  typical_pay_day integer,
  best_pay_hour integer,
  preferred_method text,
  best_method text,
  best_method_rate numeric,
  card_changes integer NOT NULL DEFAULT 0,
  expired_cards integer NOT NULL DEFAULT 0,
  suspensions integer NOT NULL DEFAULT 0,
  cancellations integer NOT NULL DEFAULT 0,
  avg_hours_suspension_to_recovery numeric,
  last_payment_at timestamptz,
  last_failure_at timestamptz,
  last_method_change_at timestamptz,
  last_login_at timestamptz,
  last_score integer,
  last_score_at timestamptz,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.billing_customer_profiles TO authenticated;
GRANT ALL ON public.billing_customer_profiles TO service_role;

ALTER TABLE public.billing_customer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own payment profile"
ON public.billing_customer_profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_billing_customer_profiles_updated_at
BEFORE UPDATE ON public.billing_customer_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_billing_customer_profiles_score ON public.billing_customer_profiles (last_score DESC NULLS LAST);

ALTER TABLE public.billing_dunning_attempts
  ADD COLUMN IF NOT EXISTS score_factors jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS strategy text;