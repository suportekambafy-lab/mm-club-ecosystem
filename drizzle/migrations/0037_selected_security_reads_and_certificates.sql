ALTER POLICY "Members can view all shorts" ON public.mm_shorts USING (public.is_club_viewer(auth.uid()) OR author_id = auth.uid());
ALTER POLICY "Members can view likes" ON public.mm_short_likes USING ((public.is_club_viewer(auth.uid()) OR user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.mm_shorts s WHERE s.id = mm_short_likes.short_id));
ALTER POLICY "Likes viewable by authenticated" ON public.community_likes USING ((public.is_club_viewer(auth.uid()) OR user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = community_likes.post_id));
ALTER POLICY "Reactions visible to authenticated" ON public.community_reactions USING ((public.is_club_viewer(auth.uid()) OR user_id = auth.uid()) AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = community_reactions.post_id));
ALTER POLICY "live_reactions_select_all" ON public.live_reactions USING (auth.uid() IS NOT NULL AND public.can_access_live(live_id, auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.live_participants lp WHERE lp.live_id = live_reactions.live_id AND lp.user_id = auth.uid() AND lp.banned));
ALTER POLICY "live_questions_select_all" ON public.live_questions USING (auth.uid() IS NOT NULL AND public.can_access_live(live_id, auth.uid()) AND NOT EXISTS (SELECT 1 FROM public.live_participants lp WHERE lp.live_id = live_questions.live_id AND lp.user_id = auth.uid() AND lp.banned));
ALTER POLICY "live_poll_options_select_all" ON public.live_poll_options USING (EXISTS (SELECT 1 FROM public.live_polls p WHERE p.id = live_poll_options.poll_id AND public.can_access_live(p.live_id, auth.uid())));
ALTER POLICY "Catalogue overrides readable by visitors" ON public.admin_overrides USING (id = 'courses');
ALTER POLICY "Catalogue overrides readable by members" ON public.admin_overrides USING (id = 'courses' OR public.has_role(auth.uid(), 'admin'));
REVOKE ALL ON FUNCTION public.issue_course_certificate(text, text, numeric, integer) FROM PUBLIC, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.issue_course_certificate_internal(_user_id uuid, _course_id text, _course_title text, _hours numeric, _lesson_ids text[])
RETURNS TABLE(code text, issued_at timestamptz, member_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE existing public.course_certificates%ROWTYPE; result_row public.course_certificates%ROWTYPE; nm text;
BEGIN
 IF _user_id IS NULL OR _course_id IS NULL OR btrim(_course_id) = '' THEN RAISE EXCEPTION 'Invalid certificate'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_user_id::text || ':' || _course_id, 0));
 SELECT c.* INTO existing FROM public.course_certificates c WHERE c.user_id = _user_id AND c.course_id = _course_id;
 IF FOUND THEN RETURN QUERY SELECT existing.code, existing.issued_at, existing.member_name; RETURN; END IF;
 IF NOT public.is_academy_viewer(_user_id) OR _course_title IS NULL OR btrim(_course_title) = '' OR _hours IS NULL OR _hours::text IN ('NaN','Infinity','-Infinity') OR _hours < 0 OR coalesce(cardinality(_lesson_ids),0) = 0 OR EXISTS (SELECT 1 FROM unnest(_lesson_ids) x(id) WHERE x.id IS NULL OR btrim(x.id) = '') OR cardinality(_lesson_ids) <> (SELECT count(DISTINCT x.id) FROM unnest(_lesson_ids) x(id)) THEN RAISE EXCEPTION 'Invalid certificate'; END IF;
 IF EXISTS (SELECT 1 FROM unnest(_lesson_ids) required(id) WHERE NOT EXISTS (SELECT 1 FROM public.lesson_progress p WHERE p.user_id = _user_id AND p.course_id = _course_id AND p.lesson_id = required.id AND p.completed IS TRUE)) THEN RAISE EXCEPTION 'Course not completed'; END IF;
 SELECT coalesce(nullif(btrim(p.display_name),''),'Membro MM Club') INTO nm FROM public.profiles p WHERE p.id = _user_id;
 INSERT INTO public.course_certificates(user_id,course_id,course_title,member_name,code,hours,lessons_total) VALUES (_user_id,_course_id,_course_title,coalesce(nm,'Membro MM Club'),'MM-' || upper(replace(gen_random_uuid()::text,'-','')),_hours,cardinality(_lesson_ids)) RETURNING * INTO result_row;
 RETURN QUERY SELECT result_row.code,result_row.issued_at,result_row.member_name;
END; $$;
REVOKE ALL ON FUNCTION public.issue_course_certificate_internal(uuid,text,text,numeric,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_course_certificate_internal(uuid,text,text,numeric,text[]) TO service_role;