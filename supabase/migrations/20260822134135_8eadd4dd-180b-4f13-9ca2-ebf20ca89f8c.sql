ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

INSERT INTO public.profiles (id, display_name, bio, is_bot, club_code_accepted_at, onboarding_completed_at)
VALUES ('27d0a73c-39a7-4a4c-a49b-4ed78c1bc411', 'MM Suporte', 'Agente oficial do MM Club. Respondo dúvidas simples na comunidade.', true, now(), now())
ON CONFLICT (id) DO UPDATE SET display_name = 'MM Suporte', is_bot = true;

CREATE OR REPLACE FUNCTION public.community_leaderboard(_days integer DEFAULT 30, _limit integer DEFAULT 20)
 RETURNS TABLE(user_id uuid, display_name text, avatar_url text, posts integer, comments integer, likes_received integer, reactions_received integer, shorts integer, score integer, rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH win AS (
    SELECT now() - (GREATEST(COALESCE(_days, 30), 1) || ' days')::interval AS since
  ),
  staff AS (
    SELECT DISTINCT ur.user_id AS uid
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'moderator')
    UNION
    SELECT pr.id FROM profiles pr WHERE pr.is_bot
  ),
  p AS (
    SELECT author_id AS uid, count(*)::int AS n
    FROM community_posts, win WHERE created_at >= win.since GROUP BY 1
  ),
  c AS (
    SELECT author_id AS uid, count(*)::int AS n
    FROM community_comments, win WHERE created_at >= win.since GROUP BY 1
  ),
  lr AS (
    SELECT cp.author_id AS uid, count(*)::int AS n
    FROM community_likes cl
    JOIN community_posts cp ON cp.id = cl.post_id
    CROSS JOIN win
    WHERE cl.created_at >= win.since AND cl.user_id <> cp.author_id
    GROUP BY 1
  ),
  rr AS (
    SELECT cp.author_id AS uid, count(*)::int AS n
    FROM community_reactions cr
    JOIN community_posts cp ON cp.id = cr.post_id
    CROSS JOIN win
    WHERE cr.created_at >= win.since AND cr.user_id <> cp.author_id
    GROUP BY 1
  ),
  s AS (
    SELECT author_id AS uid, count(*)::int AS n
    FROM mm_shorts, win WHERE created_at >= win.since GROUP BY 1
  ),
  agg AS (
    SELECT
      u.uid,
      COALESCE(p.n, 0) AS posts,
      COALESCE(c.n, 0) AS comments,
      COALESCE(lr.n, 0) AS likes_received,
      COALESCE(rr.n, 0) AS reactions_received,
      COALESCE(s.n, 0) AS shorts,
      COALESCE(p.n, 0) * 5 + COALESCE(c.n, 0) * 3 + COALESCE(lr.n, 0) * 2
        + COALESCE(rr.n, 0) * 1 + COALESCE(s.n, 0) * 6 AS score
    FROM (
      SELECT uid FROM p UNION SELECT uid FROM c UNION SELECT uid FROM lr
      UNION SELECT uid FROM rr UNION SELECT uid FROM s
    ) u
    LEFT JOIN p ON p.uid = u.uid
    LEFT JOIN c ON c.uid = u.uid
    LEFT JOIN lr ON lr.uid = u.uid
    LEFT JOIN rr ON rr.uid = u.uid
    LEFT JOIN s ON s.uid = u.uid
    WHERE u.uid NOT IN (SELECT uid FROM staff)
  )
  SELECT
    a.uid,
    COALESCE(pr.display_name, 'Membro')::text,
    pr.avatar_url::text,
    a.posts,
    a.comments,
    a.likes_received,
    a.reactions_received,
    a.shorts,
    a.score::int,
    (row_number() OVER (ORDER BY a.score DESC, a.uid))::int AS rank
  FROM agg a
  LEFT JOIN profiles pr ON pr.id = a.uid
  WHERE a.score > 0
  ORDER BY a.score DESC, a.uid
  LIMIT GREATEST(COALESCE(_limit, 20), 1)
$function$;