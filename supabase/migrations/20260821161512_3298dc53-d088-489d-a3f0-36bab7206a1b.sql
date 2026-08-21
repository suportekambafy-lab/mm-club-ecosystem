ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS views_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.community_post_increment_view(_post_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.community_posts
  SET views_count = views_count + 1
  WHERE id = _post_id;
$$;

GRANT EXECUTE ON FUNCTION public.community_post_increment_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_post_increment_view(uuid) TO service_role;