ALTER TABLE public.mmpay_links
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_id text;

CREATE TABLE public.mmpay_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.mmpay_links(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  email text,
  name text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mmpay_payments TO authenticated;
GRANT ALL ON public.mmpay_payments TO service_role;
ALTER TABLE public.mmpay_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY mmpay_payments_commercial_read ON public.mmpay_payments
  FOR SELECT TO authenticated USING (public.has_commercial_access(auth.uid()));