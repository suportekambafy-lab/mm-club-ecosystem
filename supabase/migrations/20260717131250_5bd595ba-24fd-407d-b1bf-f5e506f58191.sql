
ALTER TABLE public.mm_shorts ADD COLUMN IF NOT EXISTS comments_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.mm_short_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id uuid NOT NULL REFERENCES public.mm_shorts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mm_short_comments_short ON public.mm_short_comments(short_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mm_short_comments TO authenticated;
GRANT SELECT ON public.mm_short_comments TO anon;
GRANT ALL ON public.mm_short_comments TO service_role;

ALTER TABLE public.mm_short_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are readable by all" ON public.mm_short_comments
  FOR SELECT USING (true);

CREATE POLICY "Users insert own comments" ON public.mm_short_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own comments" ON public.mm_short_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.mm_short_comments_bump()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.mm_shorts SET comments_count = comments_count + 1 WHERE id = NEW.short_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.mm_shorts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.short_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mm_short_comments_bump_ins ON public.mm_short_comments;
CREATE TRIGGER trg_mm_short_comments_bump_ins AFTER INSERT ON public.mm_short_comments
  FOR EACH ROW EXECUTE FUNCTION public.mm_short_comments_bump();

DROP TRIGGER IF EXISTS trg_mm_short_comments_bump_del ON public.mm_short_comments;
CREATE TRIGGER trg_mm_short_comments_bump_del AFTER DELETE ON public.mm_short_comments
  FOR EACH ROW EXECUTE FUNCTION public.mm_short_comments_bump();
