
CREATE TABLE public.mm_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'mollie',
  provider_payment_id text NOT NULL UNIQUE,
  pack_id text NOT NULL,
  credits integer NOT NULL,
  amount_eur numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'open',
  fulfilled_at timestamptz,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mm_credit_orders TO authenticated;
GRANT ALL ON public.mm_credit_orders TO service_role;

ALTER TABLE public.mm_credit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own credit orders read"
  ON public.mm_credit_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX mm_credit_orders_user_idx ON public.mm_credit_orders(user_id, created_at DESC);

CREATE TRIGGER mm_credit_orders_updated_at
  BEFORE UPDATE ON public.mm_credit_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
