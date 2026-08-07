update public.lesson_transcripts
set status = 'skipped',
    error = coalesce(error, 'posta de parte: sem progresso da IA')
where lesson_id = 'l-ms1s9y94' and course_id = 'marca-milionaria';

update public.lesson_transcripts
set status = 'skipped'
where status = 'error'
  and error ilike '%não é um ficheiro áudio/vídeo directo%';