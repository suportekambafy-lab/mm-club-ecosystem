ALTER TABLE public.lives ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.notify_subscribers_when_live_starts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(NEW.is_test, false) THEN
    RETURN NEW;
  END IF;
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
$function$;