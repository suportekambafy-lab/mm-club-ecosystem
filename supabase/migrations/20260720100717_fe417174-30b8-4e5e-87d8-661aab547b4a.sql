-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per lesson: raw transcript + status
CREATE TABLE IF NOT EXISTS public.lesson_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  course_title text,
  lesson_title text,
  video_url text,
  transcript text,
  language text DEFAULT 'pt',
  status text NOT NULL DEFAULT 'pending', -- pending | transcribing | embedding | ready | error
  error text,
  duration_seconds integer,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, lesson_id)
);

GRANT SELECT ON public.lesson_transcripts TO authenticated;
GRANT ALL ON public.lesson_transcripts TO service_role;

ALTER TABLE public.lesson_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read transcripts"
  ON public.lesson_transcripts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage transcripts"
  ON public.lesson_transcripts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER lesson_transcripts_updated_at
  BEFORE UPDATE ON public.lesson_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chunks with embeddings (1536 dims = openai/text-embedding-3-small)
CREATE TABLE IF NOT EXISTS public.lesson_transcript_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL REFERENCES public.lesson_transcripts(id) ON DELETE CASCADE,
  course_id text NOT NULL,
  lesson_id text NOT NULL,
  course_title text,
  lesson_title text,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  start_seconds numeric,
  end_seconds numeric,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lesson_transcript_chunks TO authenticated;
GRANT ALL ON public.lesson_transcript_chunks TO service_role;

ALTER TABLE public.lesson_transcript_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read chunks"
  ON public.lesson_transcript_chunks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage chunks"
  ON public.lesson_transcript_chunks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS lesson_transcript_chunks_embedding_idx
  ON public.lesson_transcript_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS lesson_transcript_chunks_lesson_idx
  ON public.lesson_transcript_chunks (course_id, lesson_id);

-- Similarity search function used by MM Intelligence
CREATE OR REPLACE FUNCTION public.match_lesson_chunks(
  query_embedding vector(1536),
  match_count integer DEFAULT 6,
  min_similarity float DEFAULT 0.35
)
RETURNS TABLE (
  id uuid,
  course_id text,
  lesson_id text,
  course_title text,
  lesson_title text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.course_id,
    c.lesson_id,
    c.course_title,
    c.lesson_title,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.lesson_transcript_chunks c
  WHERE 1 - (c.embedding <=> query_embedding) >= min_similarity
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_lesson_chunks(vector, integer, float) TO authenticated;
