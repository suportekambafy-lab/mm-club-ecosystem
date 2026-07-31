INSERT INTO public.notifications (user_id, actor_id, kind, live_id)
SELECT DISTINCT subscription.user_id, live.created_by, 'live', live.id
FROM public.lives AS live
JOIN public.billing_subscriptions AS subscription
  ON subscription.status IN ('trialing', 'active')
WHERE live.id = 'd41d14b8-9be5-4bdb-9648-3e8a49373422'
  AND live.status = 'live'
  AND subscription.user_id IS NOT NULL
  AND subscription.user_id IS DISTINCT FROM live.created_by
ON CONFLICT (user_id, live_id, kind)
  WHERE kind = 'live' AND live_id IS NOT NULL
  DO NOTHING;