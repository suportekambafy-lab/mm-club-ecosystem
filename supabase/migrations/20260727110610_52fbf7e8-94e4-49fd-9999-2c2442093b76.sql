-- 1. notifications: support shorts + more kinds
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS short_id uuid REFERENCES public.mm_shorts(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS short_comment_id uuid REFERENCES public.mm_short_comments(id) ON DELETE CASCADE;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind = ANY (ARRAY['like','reply','mention','reaction','comment_reply']));

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

-- 2. MM Shorts counters
CREATE OR REPLACE FUNCTION public.mm_shorts_sync_comments_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.mm_shorts SET comments_count = comments_count + 1 WHERE id = NEW.short_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.mm_shorts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.short_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_mm_short_comments_count ON public.mm_short_comments;
CREATE TRIGGER trg_mm_short_comments_count
AFTER INSERT OR DELETE ON public.mm_short_comments
FOR EACH ROW EXECUTE FUNCTION public.mm_shorts_sync_comments_count();

CREATE OR REPLACE FUNCTION public.mm_shorts_sync_likes_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.mm_shorts SET likes_count = likes_count + 1 WHERE id = NEW.short_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.mm_shorts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.short_id;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_mm_short_likes_count ON public.mm_short_likes;
CREATE TRIGGER trg_mm_short_likes_count
AFTER INSERT OR DELETE ON public.mm_short_likes
FOR EACH ROW EXECUTE FUNCTION public.mm_shorts_sync_likes_count();

-- backfill
UPDATE public.mm_shorts s SET
  comments_count = COALESCE((SELECT count(*) FROM public.mm_short_comments c WHERE c.short_id = s.id), 0),
  likes_count = COALESCE((SELECT count(*) FROM public.mm_short_likes l WHERE l.short_id = s.id), 0);

-- 3. mention helper
CREATE OR REPLACE FUNCTION public.notify_mentions(
  _content text, _actor uuid, _post_id uuid, _comment_id uuid, _short_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  handle text;
  target uuid;
BEGIN
  IF _content IS NULL THEN RETURN; END IF;
  FOR handle IN
    SELECT DISTINCT lower(m[1]) FROM regexp_matches(_content, '@([A-Za-z0-9_\.\-]{2,40})', 'g') AS m
  LOOP
    SELECT p.id INTO target FROM public.profiles p
      WHERE lower(replace(coalesce(p.display_name,''), ' ', '')) = replace(handle, ' ', '')
      LIMIT 1;
    IF target IS NOT NULL AND target <> _actor THEN
      INSERT INTO public.notifications (user_id, actor_id, kind, post_id, comment_id, short_id)
      VALUES (target, _actor, 'mention', _post_id, _comment_id, _short_id);
    END IF;
  END LOOP;
END; $$;

-- 4. community comments -> notify post author + mentions
CREATE OR REPLACE FUNCTION public.notify_community_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT author_id INTO owner_id FROM public.community_posts WHERE id = NEW.post_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, post_id, comment_id)
    VALUES (owner_id, NEW.author_id, 'reply', NEW.post_id, NEW.id);
  END IF;
  PERFORM public.notify_mentions(NEW.content, NEW.author_id, NEW.post_id, NEW.id, NULL);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_community_comment ON public.community_comments;
CREATE TRIGGER trg_notify_community_comment
AFTER INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_community_comment();

-- 5. community post mentions
CREATE OR REPLACE FUNCTION public.notify_community_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.notify_mentions(NEW.content, NEW.author_id, NEW.id, NULL, NULL);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_community_post ON public.community_posts;
CREATE TRIGGER trg_notify_community_post
AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_community_post();

-- 6. community likes
CREATE OR REPLACE FUNCTION public.notify_community_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT author_id INTO owner_id FROM public.community_posts WHERE id = NEW.post_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, post_id)
    VALUES (owner_id, NEW.user_id, 'like', NEW.post_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_community_like ON public.community_likes;
CREATE TRIGGER trg_notify_community_like
AFTER INSERT ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_community_like();

-- 7. community reactions (post or comment)
CREATE OR REPLACE FUNCTION public.notify_community_reaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; p_id uuid;
BEGIN
  IF NEW.comment_id IS NOT NULL THEN
    SELECT author_id, post_id INTO owner_id, p_id FROM public.community_comments WHERE id = NEW.comment_id;
  ELSE
    SELECT author_id INTO owner_id FROM public.community_posts WHERE id = NEW.post_id;
    p_id := NEW.post_id;
  END IF;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, post_id, comment_id)
    VALUES (owner_id, NEW.user_id, 'reaction', p_id, NEW.comment_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_community_reaction ON public.community_reactions;
CREATE TRIGGER trg_notify_community_reaction
AFTER INSERT ON public.community_reactions
FOR EACH ROW EXECUTE FUNCTION public.notify_community_reaction();

-- 8. shorts comments -> notify short owner and parent comment author
CREATE OR REPLACE FUNCTION public.notify_short_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid; parent_author uuid;
BEGIN
  SELECT author_id INTO owner_id FROM public.mm_shorts WHERE id = NEW.short_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, short_id, short_comment_id)
    VALUES (owner_id, NEW.user_id, 'reply', NEW.short_id, NEW.id);
  END IF;
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM public.mm_short_comments WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author <> NEW.user_id AND parent_author <> owner_id THEN
      INSERT INTO public.notifications (user_id, actor_id, kind, short_id, short_comment_id)
      VALUES (parent_author, NEW.user_id, 'comment_reply', NEW.short_id, NEW.id);
    END IF;
  END IF;
  PERFORM public.notify_mentions(NEW.body, NEW.user_id, NULL, NULL, NEW.short_id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_short_comment ON public.mm_short_comments;
CREATE TRIGGER trg_notify_short_comment
AFTER INSERT ON public.mm_short_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_short_comment();

-- 9. shorts likes
CREATE OR REPLACE FUNCTION public.notify_short_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT author_id INTO owner_id FROM public.mm_shorts WHERE id = NEW.short_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, short_id)
    VALUES (owner_id, NEW.user_id, 'like', NEW.short_id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_short_like ON public.mm_short_likes;
CREATE TRIGGER trg_notify_short_like
AFTER INSERT ON public.mm_short_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_short_like();

REVOKE ALL ON FUNCTION public.notify_mentions(text, uuid, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;