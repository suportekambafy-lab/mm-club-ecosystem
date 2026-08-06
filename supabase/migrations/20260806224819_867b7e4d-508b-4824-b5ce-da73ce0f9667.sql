ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid;

CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON public.community_posts (pinned_at DESC NULLS LAST);

DROP POLICY IF EXISTS "Admins can update any post" ON public.community_posts;
CREATE POLICY "Admins can update any post"
ON public.community_posts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));