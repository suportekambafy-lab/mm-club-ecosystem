CREATE OR REPLACE FUNCTION public.match_lesson_moments(query_embedding vector, match_count integer DEFAULT 12, min_similarity double precision DEFAULT 0.25)
RETURNS TABLE(id uuid, course_id text, lesson_id text, course_title text, lesson_title text, content text, start_seconds numeric, end_seconds numeric, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT
    c.id,
    c.course_id,
    c.lesson_id,
    c.course_title,
    c.lesson_title,
    c.content,
    c.start_seconds,
    c.end_seconds,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.lesson_transcript_chunks c
  WHERE 1 - (c.embedding <=> query_embedding) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$function$;

REVOKE ALL ON FUNCTION public.match_lesson_moments(vector, integer, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_lesson_moments(vector, integer, double precision) TO authenticated, service_role;