UPDATE public.mm_studio_credits c
SET balance = GREATEST(0, c.balance - LEAST(c.balance, 400)),
    lifetime_granted = GREATEST(0, c.lifetime_granted - LEAST(c.lifetime_granted, 400)),
    updated_at = now()
FROM public.billing_subscriptions s
WHERE s.user_id = c.user_id AND s.status = 'trialing';