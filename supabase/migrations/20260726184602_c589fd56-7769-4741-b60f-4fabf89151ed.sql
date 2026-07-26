CREATE SEQUENCE IF NOT EXISTS public.billing_invoice_number_seq;

CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'MM-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.billing_invoice_number_seq')::text, 5, '0');
$$;

REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.billing_invoice_number_seq TO service_role;

CREATE UNIQUE INDEX IF NOT EXISTS billing_invoices_number_key ON public.billing_invoices (number) WHERE number IS NOT NULL;
CREATE INDEX IF NOT EXISTS billing_payments_invoice_id_idx ON public.billing_payments (invoice_id);