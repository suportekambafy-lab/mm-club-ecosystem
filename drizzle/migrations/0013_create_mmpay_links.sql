CREATE TABLE public.mmpay_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  price_id uuid REFERENCES public.catalog_prices(id),
  custom_amount_cents integer,
  custom_description text,
  created_by uuid,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mmpay_links TO authenticated;
GRANT ALL ON public.mmpay_links TO service_role;

ALTER TABLE public.mmpay_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY mmpay_links_commercial_read ON public.mmpay_links
  FOR SELECT TO authenticated
  USING (public.has_commercial_access(auth.uid()));