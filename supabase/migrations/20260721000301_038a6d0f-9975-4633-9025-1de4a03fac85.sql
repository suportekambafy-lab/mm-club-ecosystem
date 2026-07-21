
-- ============ BRAND DNA ============
CREATE TABLE public.mm_studio_brand (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT,
  logo_url TEXT,
  colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  typography TEXT,
  segment TEXT,
  audience TEXT,
  tone TEXT,
  website TEXT,
  socials JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mm_studio_brand TO authenticated;
GRANT ALL ON public.mm_studio_brand TO service_role;
ALTER TABLE public.mm_studio_brand ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brand_owner_all" ON public.mm_studio_brand FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER mm_studio_brand_updated BEFORE UPDATE ON public.mm_studio_brand
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PRODUCTS ============
CREATE TABLE public.mm_studio_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  logo_url TEXT,
  brand_colors JSONB NOT NULL DEFAULT '[]'::jsonb,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mm_studio_products_user_idx ON public.mm_studio_products(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mm_studio_products TO authenticated;
GRANT ALL ON public.mm_studio_products TO service_role;
ALTER TABLE public.mm_studio_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_owner_all" ON public.mm_studio_products FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER mm_studio_products_updated BEFORE UPDATE ON public.mm_studio_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CREDITS ============
CREATE TABLE public.mm_studio_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INT NOT NULL DEFAULT 400,
  lifetime_granted INT NOT NULL DEFAULT 400,
  lifetime_spent INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mm_studio_credits TO authenticated;
GRANT ALL ON public.mm_studio_credits TO service_role;
ALTER TABLE public.mm_studio_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credits_owner_read" ON public.mm_studio_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE public.mm_studio_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INT NOT NULL,
  reason TEXT NOT NULL,
  ref_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mm_studio_credit_ledger_user_idx ON public.mm_studio_credit_ledger(user_id, created_at DESC);
GRANT SELECT ON public.mm_studio_credit_ledger TO authenticated;
GRANT ALL ON public.mm_studio_credit_ledger TO service_role;
ALTER TABLE public.mm_studio_credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credit_ledger_owner_read" ON public.mm_studio_credit_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- ============ ASSETS ============
CREATE TABLE public.mm_studio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','video')),
  url TEXT NOT NULL,
  thumb_url TEXT,
  format TEXT,
  style TEXT,
  product_id UUID REFERENCES public.mm_studio_products(id) ON DELETE SET NULL,
  credits_used INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mm_studio_assets_user_idx ON public.mm_studio_assets(user_id, created_at DESC);
CREATE INDEX mm_studio_assets_kind_idx ON public.mm_studio_assets(user_id, kind, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mm_studio_assets TO authenticated;
GRANT ALL ON public.mm_studio_assets TO service_role;
ALTER TABLE public.mm_studio_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assets_owner_all" ON public.mm_studio_assets FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ AUTO-GRANT CREDITS ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user_studio_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.mm_studio_credits (user_id, balance, lifetime_granted)
  VALUES (NEW.id, 400, 400)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason)
  VALUES (NEW.id, 400, 'signup_bonus');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_studio_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_studio_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_studio_credits();

-- Backfill existing users
INSERT INTO public.mm_studio_credits (user_id, balance, lifetime_granted)
SELECT id, 400, 400 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason)
SELECT id, 400, 'signup_bonus_backfill' FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.mm_studio_credit_ledger l
  WHERE l.user_id = auth.users.id AND l.reason IN ('signup_bonus','signup_bonus_backfill')
);

-- ============ SPEND FUNCTION (atomic) ============
CREATE OR REPLACE FUNCTION public.mm_studio_spend_credits(
  _user_id UUID,
  _amount INT,
  _reason TEXT,
  _ref UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INT;
BEGIN
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE public.mm_studio_credits
  SET balance = balance - _amount,
      lifetime_spent = lifetime_spent + _amount,
      updated_at = now()
  WHERE user_id = _user_id AND balance >= _amount
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason, ref_id)
  VALUES (_user_id, -_amount, _reason, _ref);

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.mm_studio_refund_credits(
  _user_id UUID,
  _amount INT,
  _reason TEXT,
  _ref UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INT;
BEGIN
  UPDATE public.mm_studio_credits
  SET balance = balance + _amount,
      lifetime_spent = GREATEST(0, lifetime_spent - _amount),
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO new_balance;

  INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason, ref_id)
  VALUES (_user_id, _amount, _reason, _ref);

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.mm_studio_spend_credits(UUID, INT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mm_studio_refund_credits(UUID, INT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
