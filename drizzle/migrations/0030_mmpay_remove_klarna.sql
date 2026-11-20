-- MMpay: o Klarna deixa de estar disponível; ficam só Cartão e MB WAY pela Viva.com.
UPDATE public.mmpay_links
   SET payment_methods = array_remove(payment_methods, 'klarna')
 WHERE payment_methods @> ARRAY['klarna']::text[];

-- Nunca deixar um link sem método de pagamento.
UPDATE public.mmpay_links
   SET payment_methods = ARRAY['card']::text[]
 WHERE cardinality(payment_methods) = 0;

ALTER TABLE public.mmpay_links
   ALTER COLUMN payment_methods SET DEFAULT ARRAY['card','mb_way']::text[];