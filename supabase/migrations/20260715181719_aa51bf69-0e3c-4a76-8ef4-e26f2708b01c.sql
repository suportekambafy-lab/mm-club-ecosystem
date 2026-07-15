
ALTER TABLE public.community_posts DROP CONSTRAINT community_posts_author_id_fkey;
ALTER TABLE public.community_posts ADD CONSTRAINT community_posts_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.community_comments DROP CONSTRAINT community_comments_author_id_fkey;
ALTER TABLE public.community_comments ADD CONSTRAINT community_comments_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.community_likes DROP CONSTRAINT community_likes_user_id_fkey;
ALTER TABLE public.community_likes ADD CONSTRAINT community_likes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.community_chat_messages DROP CONSTRAINT community_chat_messages_author_id_fkey;
ALTER TABLE public.community_chat_messages ADD CONSTRAINT community_chat_messages_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
