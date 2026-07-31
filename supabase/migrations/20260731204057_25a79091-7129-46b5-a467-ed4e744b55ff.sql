ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS live_id uuid REFERENCES public.lives(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind = ANY (ARRAY['like','reply','mention','reaction','comment_reply','inactivity','onboarding','live']));

CREATE UNIQUE INDEX IF NOT EXISTS notifications_live_once_per_user_idx
  ON public.notifications (user_id, live_id, kind)
  WHERE kind = 'live' AND live_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_subscribers_when_live_starts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'live' AND OLD.status IS DISTINCT FROM 'live' THEN
    INSERT INTO public.notifications (user_id, actor_id, kind, live_id)
    SELECT DISTINCT subscription.user_id, NEW.created_by, 'live', NEW.id
    FROM public.billing_subscriptions AS subscription
    WHERE subscription.status IN ('trialing', 'active')
      AND subscription.user_id IS NOT NULL
      AND subscription.user_id IS DISTINCT FROM NEW.created_by
    ON CONFLICT (user_id, live_id, kind)
      WHERE kind = 'live' AND live_id IS NOT NULL
      DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_subscribers_when_live_starts ON public.lives;
CREATE TRIGGER trg_notify_subscribers_when_live_starts
AFTER UPDATE OF status ON public.lives
FOR EACH ROW
EXECUTE FUNCTION public.notify_subscribers_when_live_starts();

REVOKE ALL ON FUNCTION public.notify_subscribers_when_live_starts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_subscribers_when_live_starts() TO service_role;