CREATE TABLE public.lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_notes_lead_idx ON public.lead_notes(lead_id, created_at DESC);
GRANT SELECT, INSERT ON public.lead_notes TO authenticated;
GRANT ALL ON public.lead_notes TO service_role;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commercial reads lead notes" ON public.lead_notes FOR SELECT TO authenticated USING (public.has_commercial_access(auth.uid()));
CREATE POLICY "Commercial writes own lead notes" ON public.lead_notes FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND public.has_commercial_access(auth.uid()));