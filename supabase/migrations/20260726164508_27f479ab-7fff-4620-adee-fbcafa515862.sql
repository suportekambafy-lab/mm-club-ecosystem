CREATE TABLE public.billing_checkout_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  price_id uuid NOT NULL REFERENCES public.catalog_prices(id),
  coupon_code text,
  gateway text,
  gateway_payment_id text,
  status text NOT NULL DEFAULT 'pending',
  user_id uuid,
  account_created boolean NOT NULL DEFAULT false,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.billing_checkout_intents TO service_role;

ALTER TABLE public.billing_checkout_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view checkout intents"
ON public.billing_checkout_intents
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_checkout_intents_payment ON public.billing_checkout_intents (gateway, gateway_payment_id);
CREATE INDEX idx_checkout_intents_email ON public.billing_checkout_intents (lower(email));

CREATE TRIGGER update_billing_checkout_intents_updated_at
BEFORE UPDATE ON public.billing_checkout_intents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();