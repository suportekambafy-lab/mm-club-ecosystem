CREATE TABLE public.partner_link_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  partner text NOT NULL DEFAULT 'shopify',
  kind text NOT NULL CHECK (kind IN ('impression','click')),
  placement text NOT NULL,
  course_id text,
  course_title text,
  module_id text,
  module_title text,
  lesson_id text,
  lesson_title text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX partner_link_events_partner_kind_idx ON public.partner_link_events (partner, kind, created_at DESC);
CREATE INDEX partner_link_events_module_idx ON public.partner_link_events (partner, module_title);

GRANT SELECT, INSERT ON public.partner_link_events TO authenticated;
GRANT ALL ON public.partner_link_events TO service_role;

ALTER TABLE public.partner_link_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members log their own partner events"
  ON public.partner_link_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admins read partner events"
  ON public.partner_link_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.partner_conversions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner text NOT NULL DEFAULT 'shopify',
  module_key text NOT NULL,
  module_label text,
  paid_count integer NOT NULL DEFAULT 0,
  revenue_cents integer NOT NULL DEFAULT 0,
  note text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (partner, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_conversions TO authenticated;
GRANT ALL ON public.partner_conversions TO service_role;

ALTER TABLE public.partner_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage partner conversions"
  ON public.partner_conversions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));