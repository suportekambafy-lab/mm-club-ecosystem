ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sale_closed_by uuid, ADD COLUMN IF NOT EXISTS sale_closed_at timestamptz, ADD COLUMN IF NOT EXISTS sale_commission_brl_cents bigint;
COMMENT ON COLUMN public.leads.sale_closed_by IS 'User who closed the sale; legacy closed sales attributed to recorded responsible user when available.';
COMMENT ON COLUMN public.leads.sale_commission_brl_cents IS 'Commission in BRL cents, NULL when sale amount has no configured commission. Not a payment record.';
UPDATE public.leads SET sale_closed_by = responsavel_id, sale_closed_at = updated_at, sale_commission_brl_cents = CASE sale_amount_cents WHEN 99700 THEN 15000 WHEN 49700 THEN 7000 ELSE NULL END WHERE status = 'fechou';
CREATE OR REPLACE FUNCTION public.sync_lead_sale_commission() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.status = 'fechou' THEN
  NEW.sale_commission_brl_cents := CASE NEW.sale_amount_cents WHEN 99700 THEN 15000 WHEN 49700 THEN 7000 ELSE NULL END;
 ELSE
  NEW.sale_commission_brl_cents := NULL;
  NEW.sale_closed_by := NULL;
  NEW.sale_closed_at := NULL;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER lead_sale_commission_sync BEFORE INSERT OR UPDATE OF status, sale_amount_cents ON public.leads FOR EACH ROW EXECUTE FUNCTION public.sync_lead_sale_commission();
CREATE INDEX IF NOT EXISTS leads_own_closed_sales_idx ON public.leads (sale_closed_by, sale_closed_at DESC) WHERE status = 'fechou';