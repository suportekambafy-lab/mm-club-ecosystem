CREATE TABLE IF NOT EXISTS public.community_post_views (
  post_id uuid NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

GRANT SELECT, INSERT ON public.community_post_views TO authenticated;
GRANT ALL ON public.community_post_views TO service_role;

ALTER TABLE public.community_post_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Views readable by authenticated"
  ON public.community_post_views FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users insert own view"
  ON public.community_post_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_community_post_views_post ON public.community_post_views(post_id, viewed_at DESC);

INSERT INTO public.community_post_views (post_id, user_id, viewed_at)
SELECT post_id, user_id, created_at FROM public.community_likes
WHERE post_id IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.community_post_views (post_id, user_id, viewed_at)
SELECT post_id, user_id, created_at FROM public.community_reactions
WHERE post_id IS NOT NULL AND user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.community_post_views (post_id, user_id, viewed_at)
SELECT post_id, author_id, min(created_at) FROM public.community_comments
WHERE post_id IS NOT NULL AND author_id IS NOT NULL
GROUP BY post_id, author_id
ON CONFLICT DO NOTHING;

INSERT INTO public.community_post_views (post_id, user_id, viewed_at)
SELECT id, author_id, created_at FROM public.community_posts
WHERE author_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.community_post_record_view(_post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _count integer;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.community_post_views (post_id, user_id)
  VALUES (_post_id, _uid)
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO _count FROM public.community_post_views WHERE post_id = _post_id;

  UPDATE public.community_posts SET views_count = _count WHERE id = _post_id;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_post_record_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_post_viewers(_post_id uuid, _limit integer DEFAULT 200)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, viewed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v.user_id, p.display_name, p.avatar_url, v.viewed_at
  FROM public.community_post_views v
  JOIN public.profiles p ON p.id = v.user_id
  WHERE v.post_id = _post_id
  ORDER BY v.viewed_at DESC
  LIMIT COALESCE(_limit, 200);
$$;

GRANT EXECUTE ON FUNCTION public.community_post_viewers(uuid, integer) TO authenticated;

UPDATE public.community_posts p
SET views_count = COALESCE(v.c, 0)
FROM (SELECT post_id, count(*) c FROM public.community_post_views GROUP BY post_id) v
WHERE v.post_id = p.id;