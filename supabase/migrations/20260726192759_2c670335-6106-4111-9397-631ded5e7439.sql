-- 1. Admin action log: result + request id, still immutable
ALTER TABLE public.admin_action_log
  ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT 'success',
  ADD COLUMN IF NOT EXISTS request_id text;

-- 2. Device trust
CREATE TABLE IF NOT EXISTS public.security_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  browser text,
  os text,
  device_type text,
  country text,
  city text,
  last_ip text,
  trusted boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);
GRANT SELECT ON public.security_devices TO authenticated;
GRANT ALL ON public.security_devices TO service_role;
ALTER TABLE public.security_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own devices readable" ON public.security_devices
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 3. Sessions
CREATE TABLE IF NOT EXISTS public.security_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.security_devices(id) ON DELETE SET NULL,
  session_token text NOT NULL UNIQUE,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_reason text
);
CREATE INDEX IF NOT EXISTS security_sessions_user_idx ON public.security_sessions (user_id, revoked_at);
GRANT SELECT ON public.security_sessions TO authenticated;
GRANT ALL ON public.security_sessions TO service_role;
ALTER TABLE public.security_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions readable" ON public.security_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 4. Security / fraud alerts
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  level text NOT NULL DEFAULT 'warn',
  title text NOT NULL,
  detail text,
  subject text,
  user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open',
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);
GRANT SELECT ON public.security_alerts TO authenticated;
GRANT ALL ON public.security_alerts TO service_role;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read alerts" ON public.security_alerts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Continuous security scan reports
CREATE TABLE IF NOT EXISTS public.security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL DEFAULT 'manual',
  score integer NOT NULL DEFAULT 0,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.security_scans TO authenticated;
GRANT ALL ON public.security_scans TO service_role;
ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read scans" ON public.security_scans
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. Automated posture inspection used by the continuous scan
CREATE OR REPLACE FUNCTION public.security_posture_report()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'tables_total', (SELECT count(*) FROM pg_tables WHERE schemaname = 'public'),
    'tables_without_rls', (
      SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
    ),
    'tables_without_policies', (
      SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename = c.relname)
    ),
    'policies_total', (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'),
    'anon_writable_tables', (
      SELECT coalesce(jsonb_agg(DISTINCT table_name), '[]'::jsonb)
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'anon'
        AND privilege_type IN ('INSERT','UPDATE','DELETE')
    ),
    'functions_without_search_path', (
      SELECT coalesce(jsonb_agg(p.proname ORDER BY p.proname), '[]'::jsonb)
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
        AND NOT EXISTS (
          SELECT 1 FROM unnest(coalesce(p.proconfig, ARRAY[]::text[])) cfg
          WHERE cfg LIKE 'search_path=%'
        )
    ),
    'public_buckets', (
      SELECT coalesce(jsonb_agg(id ORDER BY id), '[]'::jsonb)
      FROM storage.buckets WHERE public = true
    ),
    'buckets_total', (SELECT count(*) FROM storage.buckets)
  );
$$;

REVOKE ALL ON FUNCTION public.security_posture_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_posture_report() TO service_role;