
-- 1) Table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('like','reply','mention')),
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.community_comments(id) ON DELETE CASCADE,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id) WHERE read_at IS NULL AND dismissed_at IS NULL;

-- 2) Grants
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 3) RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 5) Helper: parse @mentions from text -> resolves to user_ids via profiles.display_name
CREATE OR REPLACE FUNCTION public.extract_mention_user_ids(_text text)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m text;
  matches text[];
  handle text;
BEGIN
  IF _text IS NULL OR _text = '' THEN RETURN; END IF;
  FOR matches IN
    SELECT regexp_matches(_text, '@([A-Za-z0-9_\u00C0-\u017F][A-Za-z0-9_\u00C0-\u017F\.\-]{1,40})', 'g')
  LOOP
    handle := lower(matches[1]);
    RETURN QUERY
      SELECT p.id FROM public.profiles p
      WHERE lower(regexp_replace(coalesce(p.display_name,''), '\s+', '', 'g')) = handle
      LIMIT 1;
  END LOOP;
END;
$$;

-- 6) Trigger: like -> notify post author
CREATE OR REPLACE FUNCTION public.notify_on_community_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author uuid;
BEGIN
  SELECT author_id INTO post_author FROM public.community_posts WHERE id = NEW.post_id;
  IF post_author IS NULL OR post_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, actor_id, kind, post_id)
  VALUES (post_author, NEW.user_id, 'like', NEW.post_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_community_like
AFTER INSERT ON public.community_likes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_like();

-- 7) Trigger: comment -> notify post author (reply) + mentions
CREATE OR REPLACE FUNCTION public.notify_on_community_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author uuid;
  mentioned uuid;
  mentioned_set uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT author_id INTO post_author FROM public.community_posts WHERE id = NEW.post_id;

  -- Collect mentions first
  FOR mentioned IN SELECT public.extract_mention_user_ids(NEW.content) LOOP
    IF mentioned IS NOT NULL AND mentioned <> NEW.author_id THEN
      mentioned_set := array_append(mentioned_set, mentioned);
    END IF;
  END LOOP;

  -- Reply notification to post author (skip if author is the commenter, or if author is already in mentioned set -> prefer mention)
  IF post_author IS NOT NULL AND post_author <> NEW.author_id AND NOT (post_author = ANY(mentioned_set)) THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, post_id, comment_id)
    VALUES (post_author, NEW.author_id, 'reply', NEW.post_id, NEW.id);
  END IF;

  -- Mention notifications (dedupe)
  IF array_length(mentioned_set, 1) IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, post_id, comment_id)
    SELECT DISTINCT m, NEW.author_id, 'mention', NEW.post_id, NEW.id
    FROM unnest(mentioned_set) AS m;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_community_comment
AFTER INSERT ON public.community_comments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_comment();

-- 8) Trigger: post with @mentions -> notify mentioned users
CREATE OR REPLACE FUNCTION public.notify_on_community_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned uuid;
BEGIN
  FOR mentioned IN SELECT public.extract_mention_user_ids(NEW.content) LOOP
    IF mentioned IS NOT NULL AND mentioned <> NEW.author_id THEN
      INSERT INTO public.notifications (user_id, actor_id, kind, post_id)
      VALUES (mentioned, NEW.author_id, 'mention', NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_community_post
AFTER INSERT ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_post();
