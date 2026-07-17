
CREATE TABLE public.mm_shorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  thumbnail_url text,
  caption text,
  views_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mm_shorts TO authenticated;
GRANT ALL ON public.mm_shorts TO service_role;

ALTER TABLE public.mm_shorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view all shorts"
  ON public.mm_shorts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own shorts"
  ON public.mm_shorts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own shorts"
  ON public.mm_shorts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own shorts, admins any"
  ON public.mm_shorts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_mm_shorts_created_at ON public.mm_shorts (created_at DESC);
CREATE INDEX idx_mm_shorts_author ON public.mm_shorts (author_id);

CREATE TRIGGER update_mm_shorts_updated_at
  BEFORE UPDATE ON public.mm_shorts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Likes table
CREATE TABLE public.mm_short_likes (
  short_id uuid NOT NULL REFERENCES public.mm_shorts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (short_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.mm_short_likes TO authenticated;
GRANT ALL ON public.mm_short_likes TO service_role;

ALTER TABLE public.mm_short_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view likes"
  ON public.mm_short_likes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can like"
  ON public.mm_short_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
  ON public.mm_short_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Maintain likes_count
CREATE OR REPLACE FUNCTION public.mm_short_likes_count_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.mm_shorts SET likes_count = likes_count + 1 WHERE id = NEW.short_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.mm_shorts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.short_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER mm_short_likes_count_ins
  AFTER INSERT ON public.mm_short_likes
  FOR EACH ROW EXECUTE FUNCTION public.mm_short_likes_count_fn();

CREATE TRIGGER mm_short_likes_count_del
  AFTER DELETE ON public.mm_short_likes
  FOR EACH ROW EXECUTE FUNCTION public.mm_short_likes_count_fn();

-- Increment views RPC (auth-only)
CREATE OR REPLACE FUNCTION public.mm_short_increment_view(_short_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.mm_shorts SET views_count = views_count + 1 WHERE id = _short_id;
$$;

REVOKE ALL ON FUNCTION public.mm_short_increment_view(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mm_short_increment_view(uuid) TO authenticated;
