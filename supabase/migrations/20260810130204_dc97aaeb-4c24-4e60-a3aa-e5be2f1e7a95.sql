ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS course_id text;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind = ANY (ARRAY['like','reply','mention','reaction','comment_reply','inactivity','onboarding','live','course_released']));

CREATE UNIQUE INDEX IF NOT EXISTS notifications_course_released_unique
  ON public.notifications (user_id, course_id)
  WHERE kind = 'course_released' AND course_id IS NOT NULL;