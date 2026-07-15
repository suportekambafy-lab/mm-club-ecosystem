
-- Reactions table (works for posts and comments)
CREATE TABLE public.community_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT community_reactions_one_target CHECK ((post_id IS NULL) <> (comment_id IS NULL)),
  CONSTRAINT community_reactions_emoji_len CHECK (char_length(emoji) BETWEEN 1 AND 16)
);

CREATE UNIQUE INDEX community_reactions_unique_post
  ON public.community_reactions (user_id, post_id, emoji)
  WHERE post_id IS NOT NULL;
CREATE UNIQUE INDEX community_reactions_unique_comment
  ON public.community_reactions (user_id, comment_id, emoji)
  WHERE comment_id IS NOT NULL;
CREATE INDEX community_reactions_post_idx ON public.community_reactions(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX community_reactions_comment_idx ON public.community_reactions(comment_id) WHERE comment_id IS NOT NULL;

GRANT SELECT, INSERT, DELETE ON public.community_reactions TO authenticated;
GRANT ALL ON public.community_reactions TO service_role;

ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions visible to authenticated"
  ON public.community_reactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can add own reactions"
  ON public.community_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own reactions"
  ON public.community_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Edited marker
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.community_comments ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions;
