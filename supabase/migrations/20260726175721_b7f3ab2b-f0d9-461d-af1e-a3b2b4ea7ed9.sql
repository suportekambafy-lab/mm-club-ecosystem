DROP INDEX IF EXISTS public.billing_payment_methods_user_mandate_key;
CREATE UNIQUE INDEX billing_payment_methods_user_mandate_key
  ON public.billing_payment_methods (user_id, gateway_mandate_id);