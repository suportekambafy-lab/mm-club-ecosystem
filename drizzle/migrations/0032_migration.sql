-- Leitura social/da academia passa a exigir membro com acesso (ou equipa), em vez de qualquer conta registada.
CREATE OR REPLACE FUNCTION public.is_club_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'moderator')
    OR public.has_commercial_access(_user_id)
    OR public.has_feature(_user_id, 'community.access')
    OR public.has_feature(_user_id, 'academy.access')
    OR public.has_feature(_user_id, 'lives.access')
  )
$$;
REVOKE ALL ON FUNCTION public.is_club_viewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_club_viewer(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_academy_viewer(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'moderator')
    OR public.has_feature(_user_id, 'academy.access')
  )
$$;
REVOKE ALL ON FUNCTION public.is_academy_viewer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_academy_viewer(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Comments viewable by authenticated" ON public.community_comments;
CREATE POLICY "Comments viewable by club members" ON public.community_comments
  FOR SELECT TO authenticated USING (author_id = auth.uid() OR public.is_club_viewer(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read chat" ON public.community_chat_messages;
CREATE POLICY "Club members can read chat" ON public.community_chat_messages
  FOR SELECT TO authenticated USING (author_id = auth.uid() OR public.is_club_viewer(auth.uid()));

DROP POLICY IF EXISTS "Views readable by authenticated" ON public.community_post_views;
CREATE POLICY "Views readable by club members" ON public.community_post_views
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_club_viewer(auth.uid()));

DROP POLICY IF EXISTS "course_comments_select" ON public.course_comments;
CREATE POLICY "course_comments_select_members" ON public.course_comments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_club_viewer(auth.uid()));

DROP POLICY IF EXISTS "Comments readable by authenticated" ON public.mm_short_comments;
CREATE POLICY "Comments readable by club members" ON public.mm_short_comments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_club_viewer(auth.uid()));

DROP POLICY IF EXISTS "live_poll_votes_select_all" ON public.live_poll_votes;
CREATE POLICY "live_poll_votes_select_members" ON public.live_poll_votes
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_club_viewer(auth.uid()));

DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by club members" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_club_viewer(auth.uid()));

DROP POLICY IF EXISTS "quiz_settings_read_all" ON public.quiz_module_settings;
CREATE POLICY "quiz_settings_read_academy" ON public.quiz_module_settings
  FOR SELECT TO authenticated USING (public.is_academy_viewer(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read chunks" ON public.lesson_transcript_chunks;
CREATE POLICY "Academy members can read chunks" ON public.lesson_transcript_chunks
  FOR SELECT TO authenticated USING (public.is_academy_viewer(auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read transcripts" ON public.lesson_transcripts;
CREATE POLICY "Academy members can read transcripts" ON public.lesson_transcripts
  FOR SELECT TO authenticated USING (public.is_academy_viewer(auth.uid()));

DROP POLICY IF EXISTS "Avatars readable by authenticated" ON storage.objects;
CREATE POLICY "Avatars readable by owner or club members" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'avatars' AND (
      (storage.foldername(name))[1] = (auth.uid())::text
      OR public.is_club_viewer(auth.uid())
    )
  );