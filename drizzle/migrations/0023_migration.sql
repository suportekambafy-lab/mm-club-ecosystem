ALTER TABLE public.mmpay_links ADD COLUMN IF NOT EXISTS installment_schedule_cents integer[];
ALTER TABLE public.mmpay_subscriptions ADD COLUMN IF NOT EXISTS installment_schedule_cents integer[];