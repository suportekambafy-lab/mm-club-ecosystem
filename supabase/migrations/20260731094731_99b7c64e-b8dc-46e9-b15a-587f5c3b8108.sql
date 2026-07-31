SELECT cron.unschedule('upcoming-courses') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'upcoming-courses');

SELECT cron.schedule(
  'upcoming-courses',
  '0 11 * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/upcoming-courses',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);