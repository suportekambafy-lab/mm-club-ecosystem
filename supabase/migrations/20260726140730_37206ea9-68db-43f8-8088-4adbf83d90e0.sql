CREATE TABLE public.ops_heartbeats (
  key text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT now(),
  duration_ms integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  runs bigint NOT NULL DEFAULT 1
);

GRANT SELECT ON public.ops_heartbeats TO authenticated;
GRANT ALL ON public.ops_heartbeats TO service_role;
ALTER TABLE public.ops_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read heartbeats" ON public.ops_heartbeats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ops_webhook_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL,
  gateway_payment_id text,
  outcome text NOT NULL,
  error text,
  duration_ms integer,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ops_webhook_log_received_at_idx ON public.ops_webhook_log (received_at DESC);

GRANT SELECT ON public.ops_webhook_log TO authenticated;
GRANT ALL ON public.ops_webhook_log TO service_role;
ALTER TABLE public.ops_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read webhook log" ON public.ops_webhook_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));