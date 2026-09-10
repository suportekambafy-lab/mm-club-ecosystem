CREATE TABLE public.mm_partner_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mm_partner_accounts(id) ON DELETE CASCADE,
  code text NOT NULL,
  visitor_key text,
  referer text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mm_partner_clicks_partner_idx ON public.mm_partner_clicks(partner_id, created_at DESC);
CREATE UNIQUE INDEX mm_partner_clicks_unique_visitor ON public.mm_partner_clicks(partner_id, visitor_key) WHERE visitor_key IS NOT NULL;

GRANT SELECT ON public.mm_partner_clicks TO authenticated;
GRANT ALL ON public.mm_partner_clicks TO service_role;

ALTER TABLE public.mm_partner_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners read own clicks" ON public.mm_partner_clicks
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mm_partner_accounts a
    WHERE a.id = mm_partner_clicks.partner_id AND a.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Service role manages clicks" ON public.mm_partner_clicks
FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.mm_partner_accounts
  ADD COLUMN IF NOT EXISTS clicks_total integer NOT NULL DEFAULT 0;