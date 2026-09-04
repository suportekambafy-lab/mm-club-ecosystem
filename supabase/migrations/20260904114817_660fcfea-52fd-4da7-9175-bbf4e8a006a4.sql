CREATE TABLE public.course_comments (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
CREATE INDEX course_comments_course_idx ON public.course_comments (course_id, created_at desc);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_comments TO authenticated;
GRANT ALL ON public.course_comments TO service_role;
ALTER TABLE public.course_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "course_comments_select" ON public.course_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "course_comments_insert" ON public.course_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "course_comments_delete_own" ON public.course_comments FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));