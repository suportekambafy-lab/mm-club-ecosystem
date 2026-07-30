CREATE TABLE IF NOT EXISTS public.lesson_transcript_parts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  part_index integer NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, lesson_id, part_index)
);
CREATE INDEX IF NOT EXISTS lesson_transcript_parts_lesson_idx ON public.lesson_transcript_parts (course_id, lesson_id, part_index);
GRANT ALL ON public.lesson_transcript_parts TO service_role;
ALTER TABLE public.lesson_transcript_parts ENABLE ROW LEVEL SECURITY;