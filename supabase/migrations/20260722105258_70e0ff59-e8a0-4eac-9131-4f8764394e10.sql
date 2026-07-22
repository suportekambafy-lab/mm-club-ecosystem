CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT,
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own email log"
  ON public.email_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "service role manages email log"
  ON public.email_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX email_log_dedupe
  ON public.email_log(user_id, kind, ref)
  WHERE ref IS NOT NULL;

CREATE INDEX email_log_user_kind ON public.email_log(user_id, kind, sent_at DESC);