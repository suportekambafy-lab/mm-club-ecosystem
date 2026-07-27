select cron.schedule(
  'push-notifications-drain',
  '* * * * *',
  $$
  select net.http_post(
    url:='https://project--70574eb9-2b6c-447b-adde-9f59b54cc086.lovable.app/api/public/hooks/push-notifications',
    headers:='{"Content-Type": "application/json", "apikey": "sb_publishable_iVG0_xAe4mnY3eDdTvQBiQ_U3kuFIk-"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);