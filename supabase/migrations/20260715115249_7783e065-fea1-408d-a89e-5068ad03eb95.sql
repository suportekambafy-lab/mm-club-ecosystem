
CREATE TABLE public.community_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX community_chat_messages_created_at_idx ON public.community_chat_messages (created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.community_chat_messages TO authenticated;
GRANT ALL ON public.community_chat_messages TO service_role;

ALTER TABLE public.community_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read chat"
  ON public.community_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can post their own chat messages"
  ON public.community_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete their own chat messages"
  ON public.community_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.community_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_likes;
