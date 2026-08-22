ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check CHECK (
  kind = ANY (ARRAY[
    'like','reply','mention','reaction','comment_reply','inactivity','onboarding',
    'live','course_released','rank','moderation'
  ]::text[])
);