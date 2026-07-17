
-- 1. Fix mm_short_comments policies: scope to authenticated
DROP POLICY IF EXISTS "Comments are readable by all" ON public.mm_short_comments;
DROP POLICY IF EXISTS "Users insert own comments" ON public.mm_short_comments;
DROP POLICY IF EXISTS "Users delete own comments" ON public.mm_short_comments;

CREATE POLICY "Comments readable by authenticated"
  ON public.mm_short_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own comments"
  ON public.mm_short_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own comments"
  ON public.mm_short_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Storage: restrict course-media and lesson-videos SELECT to authenticated
DROP POLICY IF EXISTS "Public read course-media" ON storage.objects;
DROP POLICY IF EXISTS "Public read lesson-videos" ON storage.objects;

CREATE POLICY "Authenticated read course-media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'course-media');
CREATE POLICY "Authenticated read lesson-videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-videos');

-- 3. Storage: restrict UPDATE/DELETE on course-media and lesson-videos to admins
DROP POLICY IF EXISTS "Authenticated update course-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete course-media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update lesson-videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete lesson-videos" ON storage.objects;

CREATE POLICY "Admins update course-media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'course-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'course-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete course-media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'course-media' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update lesson-videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-videos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'lesson-videos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete lesson-videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-videos' AND public.has_role(auth.uid(), 'admin'));

-- 4. Revoke EXECUTE on SECURITY DEFINER functions from anon and (where safe) authenticated.
-- RLS-helper functions run as definer inside policies regardless of caller EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_live(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_short_likes_count_fn() FROM PUBLIC, anon, authenticated;
-- mm_short_increment_view is an RPC called by signed-in clients; keep authenticated, revoke anon.
REVOKE EXECUTE ON FUNCTION public.mm_short_increment_view(uuid) FROM PUBLIC, anon;
