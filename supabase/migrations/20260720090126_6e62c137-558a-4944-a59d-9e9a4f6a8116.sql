
CREATE TABLE public.admin_overrides (
  id text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

GRANT SELECT ON public.admin_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_overrides TO authenticated;
GRANT ALL ON public.admin_overrides TO service_role;

ALTER TABLE public.admin_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_overrides readable by all"
  ON public.admin_overrides FOR SELECT
  USING (true);

CREATE POLICY "admin_overrides writable by admins"
  ON public.admin_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_overrides updatable by admins"
  ON public.admin_overrides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_overrides deletable by admins"
  ON public.admin_overrides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.admin_overrides (id, data) VALUES ('courses', '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;
