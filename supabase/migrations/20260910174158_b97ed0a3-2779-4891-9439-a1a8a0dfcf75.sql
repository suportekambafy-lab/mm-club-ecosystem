CREATE TABLE public.mm_partner_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active',
  accepted_at timestamptz NOT NULL DEFAULT now(),
  payout_method text,
  payout_target text,
  payout_holder text,
  free_benefit_active boolean NOT NULL DEFAULT false,
  free_benefit_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.mm_partner_accounts TO authenticated;
GRANT ALL ON public.mm_partner_accounts TO service_role;
ALTER TABLE public.mm_partner_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner reads own account" ON public.mm_partner_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "member joins partners" ON public.mm_partner_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "partner updates own payout data" ON public.mm_partner_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.mm_partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mm_partner_accounts(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'pending',
  first_paid_at timestamptz,
  reward_kind text,
  reward_cents integer NOT NULL DEFAULT 0,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mm_partner_referrals_partner_idx ON public.mm_partner_referrals(partner_id);
GRANT SELECT ON public.mm_partner_referrals TO authenticated;
GRANT ALL ON public.mm_partner_referrals TO service_role;
ALTER TABLE public.mm_partner_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner reads own referrals" ON public.mm_partner_referrals FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.mm_partner_accounts a WHERE a.id = partner_id AND a.user_id = auth.uid()
  )
);

CREATE TABLE public.mm_partner_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mm_partner_accounts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  amount_cents integer NOT NULL,
  referral_id uuid REFERENCES public.mm_partner_referrals(id) ON DELETE SET NULL,
  ref_key text UNIQUE,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mm_partner_ledger_partner_idx ON public.mm_partner_ledger(partner_id);
GRANT SELECT ON public.mm_partner_ledger TO authenticated;
GRANT ALL ON public.mm_partner_ledger TO service_role;
ALTER TABLE public.mm_partner_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner reads own ledger" ON public.mm_partner_ledger FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.mm_partner_accounts a WHERE a.id = partner_id AND a.user_id = auth.uid()
  )
);

CREATE TABLE public.mm_partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.mm_partner_accounts(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL,
  method text NOT NULL,
  target text NOT NULL,
  holder text,
  status text NOT NULL DEFAULT 'requested',
  note text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mm_partner_payouts_partner_idx ON public.mm_partner_payouts(partner_id);
GRANT SELECT, INSERT ON public.mm_partner_payouts TO authenticated;
GRANT ALL ON public.mm_partner_payouts TO service_role;
ALTER TABLE public.mm_partner_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "partner reads own payouts" ON public.mm_partner_payouts FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR EXISTS (
    SELECT 1 FROM public.mm_partner_accounts a WHERE a.id = partner_id AND a.user_id = auth.uid()
  )
);
CREATE POLICY "partner requests own payout" ON public.mm_partner_payouts FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.mm_partner_accounts a WHERE a.id = partner_id AND a.user_id = auth.uid())
);

CREATE TRIGGER mm_partner_accounts_updated_at BEFORE UPDATE ON public.mm_partner_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mm_partner_referrals_updated_at BEFORE UPDATE ON public.mm_partner_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mm_partner_payouts_updated_at BEFORE UPDATE ON public.mm_partner_payouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();