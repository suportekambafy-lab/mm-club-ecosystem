CREATE OR REPLACE FUNCTION public.is_read_only_mode()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT (value->>'enabled')::boolean FROM public.security_settings WHERE key = 'read_only'), false)
$$;

REVOKE EXECUTE ON FUNCTION public.is_read_only_mode() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_read_only_mode() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_read_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF public.is_read_only_mode() THEN
    RAISE EXCEPTION 'read_only_mode: writes are temporarily suspended for maintenance';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_posts','community_comments','community_likes','community_reactions','community_chat_messages','mm_shorts','profiles']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_read_only_%1$s ON public.%1$I', t);
      EXECUTE format('CREATE TRIGGER trg_read_only_%1$s BEFORE INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.enforce_read_only()', t);
    END IF;
  END LOOP;
END $$;