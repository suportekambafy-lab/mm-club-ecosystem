ALTER TABLE public.leads ADD COLUMN call_scheduled_at timestamptz;
CREATE INDEX leads_responsavel_call_idx ON public.leads (responsavel_id, call_scheduled_at) WHERE status = 'call_marcada';
COMMENT ON COLUMN public.leads.call_scheduled_at IS 'Call scheduled by commercial staff; stored as an absolute timestamp.';