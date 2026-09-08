select cron.unschedule('mm-winback-intelligence') where exists (select 1 from cron.job where jobname = 'mm-winback-intelligence');

select cron.schedule(
  'mm-winback-intelligence',
  '5 10 * * *',
  $$
  select net.http_post(
    url := 'https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/winback-intelligence',
    headers := public.cron_hook_headers(),
    body := '{}'::jsonb
  );
  $$
);