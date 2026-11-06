ALTER TABLE public.mmpay_links ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.mmpay_payments DROP CONSTRAINT mmpay_payments_link_id_fkey;
ALTER TABLE public.mmpay_payments ADD CONSTRAINT mmpay_payments_link_id_fkey FOREIGN KEY (link_id) REFERENCES public.mmpay_links(id) ON DELETE RESTRICT;