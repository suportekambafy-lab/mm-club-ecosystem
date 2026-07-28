-- Scheduled jobs must authenticate with a server-only secret, not the public anon key.
CREATE OR REPLACE FUNCTION public.cron_hook_headers()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', (SELECT value->>'secret' FROM public.security_settings WHERE key = 'cron_secret')
  );
$$;

REVOKE ALL ON FUNCTION public.cron_hook_headers() FROM PUBLIC, anon, authenticated;

SELECT cron.alter_job(2, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/weekly-summary',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
$cmd$);

SELECT cron.alter_job(3, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/lives-recording-check',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
$cmd$);

SELECT cron.alter_job(4, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/billing-tick',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
$cmd$);

SELECT cron.alter_job(5, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/lives-announce-catchup',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
$cmd$);

SELECT cron.alter_job(6, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/push-notifications',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
$cmd$);

SELECT cron.alter_job(7, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/auto-transcribe',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
$cmd$);

SELECT cron.alter_job(8, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/waitlist-broadcast',
    headers := public.cron_hook_headers(),
    body := '{"kind": "open"}'::jsonb
  ) AS request_id;
$cmd$);

-- Push notification trigger must use the same private key.
CREATE OR REPLACE FUNCTION public.request_push_notification_delivery()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/push-notifications',
    headers := public.cron_hook_headers(),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;