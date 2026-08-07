UPDATE public.lesson_transcripts
SET video_url = replace(video_url, ' ', ''),
    status = 'pending',
    error = NULL,
    updated_at = now()
WHERE video_url ILIKE '%pandavideo%'
  AND status IN ('skipped','error');