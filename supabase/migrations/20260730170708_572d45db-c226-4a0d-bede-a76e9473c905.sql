SELECT cron.schedule(
  'inactivity-nudge',
  '0 10 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/inactivity-nudge',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);