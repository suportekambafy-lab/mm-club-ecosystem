CREATE OR REPLACE FUNCTION public.notify_community_top_ranks(_limit integer DEFAULT 5)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  inserted integer := 0;
BEGIN
  FOR r IN
    SELECT user_id, rank FROM public.community_leaderboard(30, GREATEST(COALESCE(_limit, 5), 1))
  LOOP
    -- Evita repetir: só notifica se ainda não recebeu aviso nas últimas 24h.
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.user_id
        AND n.kind = 'rank'
        AND n.created_at > now() - interval '24 hours'
    ) THEN
      INSERT INTO public.notifications (user_id, kind, course_id)
      VALUES (r.user_id, 'rank', 'top-' || r.rank::text);
      inserted := inserted + 1;
    END IF;
  END LOOP;
  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_community_top_ranks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_community_top_ranks(integer) TO service_role;

SELECT cron.schedule(
  'community-top-ranks',
  '0 9 * * *',
  $$SELECT public.notify_community_top_ranks(5)$$
);