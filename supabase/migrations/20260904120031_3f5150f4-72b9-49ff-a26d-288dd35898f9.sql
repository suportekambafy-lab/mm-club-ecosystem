ALTER TABLE public.course_comments ADD COLUMN IF NOT EXISTS lesson_id text;
CREATE INDEX IF NOT EXISTS course_comments_lesson_idx ON public.course_comments (course_id, lesson_id, created_at DESC);