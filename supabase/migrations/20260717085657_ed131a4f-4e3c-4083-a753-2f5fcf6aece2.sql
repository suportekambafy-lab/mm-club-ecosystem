-- Expand notification kinds and add trigger for reactions
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind = ANY (ARRAY['like'::text, 'reply'::text, 'mention'::text, 'reaction'::text]));

CREATE OR REPLACE FUNCTION public.notify_on_community_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_author uuid;
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    SELECT author_id INTO target_author FROM public.community_posts WHERE id = NEW.post_id;
  ELSIF NEW.comment_id IS NOT NULL THEN
    SELECT author_id INTO target_author FROM public.community_comments WHERE id = NEW.comment_id;
  END IF;

  IF target_author IS NULL OR target_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, kind, post_id, comment_id)
  VALUES (target_author, NEW.user_id, 'reaction', NEW.post_id, NEW.comment_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_community_reaction ON public.community_reactions;
CREATE TRIGGER trg_notify_on_community_reaction
AFTER INSERT ON public.community_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_reaction();

-- Ensure triggers for likes / comments exist too (idempotent)
DROP TRIGGER IF EXISTS trg_notify_on_community_like ON public.community_likes;
CREATE TRIGGER trg_notify_on_community_like
AFTER INSERT ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_like();

DROP TRIGGER IF EXISTS trg_notify_on_community_comment ON public.community_comments;
CREATE TRIGGER trg_notify_on_community_comment
AFTER INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_comment();

DROP TRIGGER IF EXISTS trg_notify_on_community_post ON public.community_posts;
CREATE TRIGGER trg_notify_on_community_post
AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_post();