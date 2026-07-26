CREATE TABLE public.notification_templates (
  key text PRIMARY KEY,
  channel text NOT NULL DEFAULT 'email',
  locale text NOT NULL DEFAULT 'pt-PT',
  category text NOT NULL DEFAULT 'account',
  subject text NOT NULL,
  preview_text text NOT NULL DEFAULT '',
  heading text,
  body_html text NOT NULL,
  text_body text,
  cta_label text,
  cta_url text,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  updated_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification templates"
ON public.notification_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_notification_templates_updated_at
BEFORE UPDATE ON public.notification_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  recipient text NOT NULL,
  channel text NOT NULL DEFAULT 'email',
  template_key text NOT NULL,
  category text NOT NULL DEFAULT 'account',
  event_type text,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  reason text,
  provider_id text,
  dedupe_key text,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  opened_at timestamp with time zone,
  clicked_at timestamp with time zone,
  resent_of uuid,
  resent_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notification_log TO authenticated;
GRANT ALL ON public.notification_log TO service_role;

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own communications"
ON public.notification_log FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins read all communications"
ON public.notification_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX notification_log_dedupe_key_idx
ON public.notification_log (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE INDEX notification_log_user_idx
ON public.notification_log (user_id, created_at DESC);

CREATE INDEX notification_log_template_idx
ON public.notification_log (template_key, created_at DESC);

CREATE INDEX notification_log_recent_idx
ON public.notification_log (created_at DESC);