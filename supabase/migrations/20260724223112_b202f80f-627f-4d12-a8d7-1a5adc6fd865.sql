UPDATE public.lesson_transcripts
SET status = 'error',
    error = 'Worker travou (transcrição em curso há dias). Reinício manual.',
    updated_at = now() - interval '10 minutes'
WHERE course_id = 'marca-milionaria'
  AND lesson_id = 'l-mrt126tt'
  AND status = 'transcribing';