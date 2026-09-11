-- Adesão ao MM Partners passa a ser por pedido aprovado pela equipa:
-- o membro já não pode criar nem promover a sua própria conta de parceiro.
DROP POLICY IF EXISTS "member joins partners" ON public.mm_partner_accounts;
DROP POLICY IF EXISTS "partner updates own payout data" ON public.mm_partner_accounts;

CREATE POLICY "partner updates own payout data"
  ON public.mm_partner_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND status = (SELECT a.status FROM public.mm_partner_accounts a WHERE a.id = id)
  );
