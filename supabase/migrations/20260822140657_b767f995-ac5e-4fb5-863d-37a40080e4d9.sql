with ordered as (
  select id, transcript_id,
         sum(length(content)) over (partition by transcript_id order by chunk_index rows between unbounded preceding and 1 preceding) as before_chars,
         length(content) as own_chars
  from public.lesson_transcript_chunks
)
update public.lesson_transcript_chunks c
set start_seconds = floor(coalesce(o.before_chars, 0) / 15.0),
    end_seconds = ceil((coalesce(o.before_chars, 0) + o.own_chars) / 15.0)
from ordered o
where o.id = c.id;