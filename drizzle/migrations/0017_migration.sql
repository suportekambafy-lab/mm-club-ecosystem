ALTER TABLE public.mmpay_links
  ADD COLUMN billing_type text NOT NULL DEFAULT 'one_time' CHECK (billing_type IN ('one_time','subscription')),
  ADD COLUMN billing_interval text CHECK (billing_interval IN ('week','month','year')),
  ADD COLUMN billing_interval_count integer CHECK (billing_interval_count BETWEEN 1 AND 24),
  ADD COLUMN total_cycles integer CHECK (total_cycles BETWEEN 1 AND 600);

CREATE TABLE public.mmpay_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES public.mmpay_links(id) ON DELETE SET NULL,
  product_title text NOT NULL,
  customer_email text NOT NULL,
  customer_name text,
  customer_phone text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 100),
  currency text NOT NULL DEFAULT 'EUR',
  billing_interval text NOT NULL CHECK (billing_interval IN ('week','month','year')),
  billing_interval_count integer NOT NULL CHECK (billing_interval_count BETWEEN 1 AND 24),
  total_cycles integer CHECK (total_cycles BETWEEN 1 AND 600),
  charges_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','past_due','cancelled','completed')),
  started_at timestamptz,
  next_charge_at timestamptz,
  last_charge_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  failed_attempts integer NOT NULL DEFAULT 0,
  viva_initial_order_code text NOT NULL UNIQUE,
  viva_initial_transaction_id text,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mmpay_subscriptions TO service_role;
ALTER TABLE public.mmpay_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial read subscriptions" ON public.mmpay_subscriptions
  FOR SELECT TO authenticated USING (public.has_commercial_access(auth.uid()));
GRANT SELECT ON public.mmpay_subscriptions TO authenticated;
CREATE INDEX mmpay_subscriptions_due ON public.mmpay_subscriptions (next_charge_at) WHERE status IN ('active','past_due');

CREATE TABLE public.mmpay_subscription_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.mmpay_subscriptions(id) ON DELETE RESTRICT,
  cycle_number integer NOT NULL CHECK (cycle_number >= 1),
  attempt integer NOT NULL DEFAULT 1,
  amount_cents integer NOT NULL,
  status text NOT NULL CHECK (status IN ('processing','paid','failed')),
  viva_transaction_id text,
  viva_order_code text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (subscription_id, cycle_number, attempt)
);
CREATE UNIQUE INDEX mmpay_charges_one_paid_per_cycle ON public.mmpay_subscription_charges (subscription_id, cycle_number) WHERE status IN ('paid','processing');
GRANT ALL ON public.mmpay_subscription_charges TO service_role;
GRANT SELECT ON public.mmpay_subscription_charges TO authenticated;
ALTER TABLE public.mmpay_subscription_charges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commercial read charges" ON public.mmpay_subscription_charges
  FOR SELECT TO authenticated USING (public.has_commercial_access(auth.uid()));

-- Atomic claim: only one worker at a time may charge a subscription.
CREATE OR REPLACE FUNCTION public.mmpay_claim_due_subscriptions(_limit integer)
RETURNS SETOF public.mmpay_subscriptions
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.mmpay_subscriptions s
     SET locked_until = now() + interval '10 minutes', updated_at = now()
   WHERE s.id IN (
     SELECT id FROM public.mmpay_subscriptions
      WHERE status IN ('active','past_due') AND next_charge_at <= now()
        AND (locked_until IS NULL OR locked_until < now())
      ORDER BY next_charge_at
      LIMIT _limit
      FOR UPDATE SKIP LOCKED)
  RETURNING s.*;
$$;
REVOKE ALL ON FUNCTION public.mmpay_claim_due_subscriptions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mmpay_claim_due_subscriptions(integer) TO service_role;