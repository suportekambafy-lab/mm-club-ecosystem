CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_one_live_per_product
  ON public.billing_subscriptions (user_id, product_id)
  WHERE status IN ('trialing', 'active', 'past_due', 'grace_period', 'suspended');