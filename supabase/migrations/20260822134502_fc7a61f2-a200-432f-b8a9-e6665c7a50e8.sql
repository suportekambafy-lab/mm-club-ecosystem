SELECT cron.schedule(
  'support-bot-sweep',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/support-bot-sweep',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);