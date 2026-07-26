-- Remove duplicated saved payment methods (same gateway mandate), keep oldest
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY user_id, gateway_mandate_id ORDER BY created_at ASC, id ASC
  ) AS rn
  FROM public.billing_payment_methods
  WHERE gateway_mandate_id IS NOT NULL
)
DELETE FROM public.billing_payment_methods p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1
  AND NOT EXISTS (
    SELECT 1 FROM public.billing_subscriptions s WHERE s.payment_method_id = p.id
  );

-- Prevent the race that created them in the first place
CREATE UNIQUE INDEX IF NOT EXISTS billing_payment_methods_user_mandate_key
  ON public.billing_payment_methods (user_id, gateway_mandate_id)
  WHERE gateway_mandate_id IS NOT NULL;