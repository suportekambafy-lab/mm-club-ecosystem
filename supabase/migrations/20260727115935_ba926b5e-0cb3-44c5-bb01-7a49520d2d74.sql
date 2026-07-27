CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  failed_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX push_subscriptions_user_idx
ON public.push_subscriptions (user_id)
WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.update_push_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_push_subscriptions_updated_at();

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS push_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS push_error text,
ADD COLUMN IF NOT EXISTS push_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS notifications_push_pending_idx
ON public.notifications (created_at)
WHERE push_sent_at IS NULL AND dismissed_at IS NULL;

CREATE OR REPLACE FUNCTION public.request_push_notification_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/push-notifications',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_iVG0_xAe4mnY3eDdTvQBiQ_U3kuFIk-"}'::jsonb,
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_push_notification_delivery ON public.notifications;
CREATE TRIGGER trg_request_push_notification_delivery
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.request_push_notification_delivery();

REVOKE ALL ON FUNCTION public.request_push_notification_delivery() FROM PUBLIC, anon, authenticated;