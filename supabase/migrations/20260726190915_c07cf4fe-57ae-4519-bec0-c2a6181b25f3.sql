-- 1. admin_overrides: leitura só admin
DROP POLICY IF EXISTS "admin_overrides readable by all" ON public.admin_overrides;
CREATE POLICY "admin_overrides readable by admins"
  ON public.admin_overrides FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2. Storage: course-media / lesson-videos
DROP POLICY IF EXISTS "Authenticated read course-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read lesson-videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload course-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload lesson-videos" ON storage.objects;

CREATE POLICY "Entitled read course-media" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-media' AND (public.has_role(auth.uid(),'admin') OR public.has_feature(auth.uid(),'academy.access')));
CREATE POLICY "Entitled read lesson-videos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-videos' AND (public.has_role(auth.uid(),'admin') OR public.has_feature(auth.uid(),'academy.access')));
CREATE POLICY "Admins upload course-media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-media' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins upload lesson-videos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-videos' AND public.has_role(auth.uid(),'admin'));

-- 3. Eventos de segurança
CREATE TABLE public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  user_id uuid,
  actor_email text,
  ip text,
  user_agent text,
  route text,
  outcome text NOT NULL DEFAULT 'blocked',
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_events admin read" ON public.security_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX security_events_created_idx ON public.security_events (created_at DESC);
CREATE INDEX security_events_kind_idx ON public.security_events (kind, created_at DESC);
CREATE INDEX security_events_ip_idx ON public.security_events (ip, created_at DESC);

-- 4. Contadores de rate limit / WAF
CREATE TABLE public.security_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, subject, window_start)
);
GRANT ALL ON public.security_counters TO service_role;
ALTER TABLE public.security_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_counters admin read" ON public.security_counters FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX security_counters_window_idx ON public.security_counters (window_start);

-- Incremento atómico com janela deslizante
CREATE OR REPLACE FUNCTION public.security_bump_counter(_bucket text, _subject text, _window_seconds integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ws timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  c integer;
BEGIN
  INSERT INTO public.security_counters (bucket, subject, window_start, count)
  VALUES (_bucket, _subject, ws, 1)
  ON CONFLICT (bucket, subject, window_start)
  DO UPDATE SET count = public.security_counters.count + 1, updated_at = now()
  RETURNING count INTO c;
  RETURN c;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.security_bump_counter(text, text, integer) FROM public, anon, authenticated;

-- 5. Definições de segurança (kill switch)
CREATE TABLE public.security_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.security_settings TO authenticated;
GRANT ALL ON public.security_settings TO service_role;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "security_settings admin read" ON public.security_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.security_settings (key, value)
VALUES ('emergency_mode', '{"enabled": false, "reason": null, "since": null}'::jsonb);

-- 6. Registo de ações administrativas
CREATE TABLE public.admin_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  geo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_action_log TO authenticated;
GRANT ALL ON public.admin_action_log TO service_role;
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_action_log admin read" ON public.admin_action_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX admin_action_log_created_idx ON public.admin_action_log (created_at DESC);