INSERT INTO public.billing_settings (key, value, description) VALUES ('studio_qc_monthly_absorbed_credits', '{"limit": 20000}'::jsonb, 'Limite mensal de creditos MM Studio absorvidos pelo MM Club em regeneracoes automaticas de qualidade.') ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.mm_studio_qc_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  asset_id uuid,
  verdict text NOT NULL,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric NOT NULL DEFAULT 0,
  regenerated_segments int NOT NULL DEFAULT 0,
  credits_absorbed int NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.mm_studio_qc_log TO authenticated;
GRANT ALL ON public.mm_studio_qc_log TO service_role;

ALTER TABLE public.mm_studio_qc_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own studio QC log" ON public.mm_studio_qc_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins read all studio QC log" ON public.mm_studio_qc_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_mm_studio_qc_log_user ON public.mm_studio_qc_log (user_id, created_at DESC);