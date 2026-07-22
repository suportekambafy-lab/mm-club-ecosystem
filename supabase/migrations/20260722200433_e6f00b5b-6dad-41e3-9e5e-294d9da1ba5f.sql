
CREATE TABLE public.mm_mollie_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mollie_customer_id TEXT NOT NULL,
  mollie_subscription_id TEXT,
  mollie_mandate_id TEXT,
  first_payment_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_eur NUMERIC(10,2) NOT NULL,
  interval TEXT NOT NULL DEFAULT '1 month',
  trial_ends_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.mm_mollie_subscriptions(user_id);
CREATE UNIQUE INDEX ON public.mm_mollie_subscriptions(first_payment_id);
GRANT SELECT ON public.mm_mollie_subscriptions TO authenticated;
GRANT ALL ON public.mm_mollie_subscriptions TO service_role;
ALTER TABLE public.mm_mollie_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own mollie subscriptions"
  ON public.mm_mollie_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
