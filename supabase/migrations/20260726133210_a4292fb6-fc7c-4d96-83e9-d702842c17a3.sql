-- =========================================================
-- MM CLUB BILLING ENGINE — Foundation
-- =========================================================

-- ---------- ENUMS ----------
CREATE TYPE public.catalog_product_kind AS ENUM (
  'subscription','course','event','credit_pack','certificate','addon','physical'
);
CREATE TYPE public.catalog_price_interval AS ENUM ('day','week','month','year','one_time','lifetime');
CREATE TYPE public.billing_subscription_status AS ENUM (
  'trialing','active','past_due','grace_period','suspended','cancelled','expired'
);
CREATE TYPE public.billing_payment_status AS ENUM (
  'pending','authorized','paid','failed','expired','canceled','refunded','partially_refunded','chargeback'
);
CREATE TYPE public.billing_invoice_status AS ENUM ('draft','issued','paid','void','uncollectible','refunded');
CREATE TYPE public.billing_ledger_entry_type AS ENUM (
  'payment','refund','chargeback','credit_granted','credit_consumed','adjustment','discount','tax','payout'
);
CREATE TYPE public.billing_ledger_direction AS ENUM ('debit','credit');
CREATE TYPE public.entitlement_source AS ENUM ('subscription','purchase','manual','gift','promo','signup');
CREATE TYPE public.job_status AS ENUM ('pending','running','done','failed','dead');

-- =========================================================
-- CATALOG (transversal: billing, loja, academia, eventos)
-- =========================================================
CREATE TABLE public.catalog_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind public.catalog_product_kind NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.catalog_products TO anon, authenticated;
GRANT ALL ON public.catalog_products TO service_role;
ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_products_public_read" ON public.catalog_products
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "catalog_products_admin_all" ON public.catalog_products
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.catalog_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  version INTEGER NOT NULL DEFAULT 1,
  replaces_price_id UUID REFERENCES public.catalog_prices(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  interval public.catalog_price_interval NOT NULL,
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count > 0),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  -- for credit_pack products
  grants_credits INTEGER NOT NULL DEFAULT 0 CHECK (grants_credits >= 0),
  display_label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catalog_prices_product ON public.catalog_prices(product_id) WHERE active;
GRANT SELECT ON public.catalog_prices TO anon, authenticated;
GRANT ALL ON public.catalog_prices TO service_role;
ALTER TABLE public.catalog_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_prices_public_read" ON public.catalog_prices
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "catalog_prices_admin_all" ON public.catalog_prices
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- ENTITLEMENTS (domínio independente do billing)
-- =========================================================
CREATE TABLE public.entitlement_features (
  key TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_quota BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.entitlement_features TO anon, authenticated;
GRANT ALL ON public.entitlement_features TO service_role;
ALTER TABLE public.entitlement_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "features_public_read" ON public.entitlement_features FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "features_admin_all" ON public.entitlement_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.catalog_product_features (
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES public.entitlement_features(key) ON DELETE CASCADE,
  quota INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, feature_key)
);
GRANT SELECT ON public.catalog_product_features TO anon, authenticated;
GRANT ALL ON public.catalog_product_features TO service_role;
ALTER TABLE public.catalog_product_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_features_public_read" ON public.catalog_product_features FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "product_features_admin_all" ON public.catalog_product_features FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.entitlement_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL REFERENCES public.entitlement_features(key) ON DELETE CASCADE,
  source public.entitlement_source NOT NULL,
  source_id UUID,
  quota INTEGER,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_entitlement_grants_user ON public.entitlement_grants(user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX idx_entitlement_grants_unique_source
  ON public.entitlement_grants(user_id, feature_key, source, COALESCE(source_id,'00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT ON public.entitlement_grants TO authenticated;
GRANT ALL ON public.entitlement_grants TO service_role;
ALTER TABLE public.entitlement_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "grants_own_read" ON public.entitlement_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "grants_admin_all" ON public.entitlement_grants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- EVENT BUS + JOB QUEUE + AUDIT
-- =========================================================
CREATE TABLE public.domain_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id UUID,
  idempotency_key TEXT UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_domain_events_aggregate ON public.domain_events(aggregate_type, aggregate_id, occurred_at DESC);
CREATE INDEX idx_domain_events_type ON public.domain_events(type, occurred_at DESC);
GRANT SELECT ON public.domain_events TO authenticated;
GRANT ALL ON public.domain_events TO service_role;
ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_events_admin_read" ON public.domain_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.job_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.domain_events(id) ON DELETE CASCADE,
  consumer TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.job_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_job_queue_event_consumer ON public.job_queue(event_id, consumer) WHERE event_id IS NOT NULL;
CREATE INDEX idx_job_queue_pending ON public.job_queue(status, run_after);
GRANT SELECT ON public.job_queue TO authenticated;
GRANT ALL ON public.job_queue TO service_role;
ALTER TABLE public.job_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_queue_admin_read" ON public.job_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id, created_at DESC);
GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_admin_read" ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- BILLING
-- =========================================================
CREATE TABLE public.billing_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  company_name TEXT,
  tax_id TEXT,
  tax_country TEXT,
  address JSONB NOT NULL DEFAULT '{}'::jsonb,
  currency TEXT NOT NULL DEFAULT 'EUR',
  gateway TEXT,
  gateway_customer_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_customers_gateway ON public.billing_customers(gateway, gateway_customer_id);
GRANT SELECT ON public.billing_customers TO authenticated;
GRANT ALL ON public.billing_customers TO service_role;
ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_customers_own_read" ON public.billing_customers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "billing_customers_admin_all" ON public.billing_customers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  gateway TEXT NOT NULL,
  gateway_mandate_id TEXT,
  method TEXT,
  brand TEXT,
  last4 TEXT,
  exp_month INTEGER,
  exp_year INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'valid',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_pm_user ON public.billing_payment_methods(user_id);
GRANT SELECT ON public.billing_payment_methods TO authenticated;
GRANT ALL ON public.billing_payment_methods TO service_role;
ALTER TABLE public.billing_payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_pm_own_read" ON public.billing_payment_methods FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "billing_pm_admin_all" ON public.billing_payment_methods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id),
  price_id UUID NOT NULL REFERENCES public.catalog_prices(id),
  status public.billing_subscription_status NOT NULL DEFAULT 'trialing',
  gateway TEXT,
  gateway_subscription_id TEXT,
  payment_method_id UUID REFERENCES public.billing_payment_methods(id) ON DELETE SET NULL,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  scheduled_price_id UUID REFERENCES public.catalog_prices(id) ON DELETE SET NULL,
  scheduled_change_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  coupon_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_subs_user ON public.billing_subscriptions(user_id, status);
CREATE INDEX idx_billing_subs_gateway ON public.billing_subscriptions(gateway, gateway_subscription_id);
GRANT SELECT ON public.billing_subscriptions TO authenticated;
GRANT ALL ON public.billing_subscriptions TO service_role;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_subs_own_read" ON public.billing_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "billing_subs_admin_all" ON public.billing_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.billing_customers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  status public.billing_invoice_status NOT NULL DEFAULT 'draft',
  currency TEXT NOT NULL DEFAULT 'EUR',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  discount_cents INTEGER NOT NULL DEFAULT 0,
  tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  tax_country TEXT,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  pdf_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_invoices_user ON public.billing_invoices(user_id, created_at DESC);
GRANT SELECT ON public.billing_invoices TO authenticated;
GRANT ALL ON public.billing_invoices TO service_role;
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_invoices_own_read" ON public.billing_invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "billing_invoices_admin_all" ON public.billing_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.billing_invoices(id) ON DELETE SET NULL,
  price_id UUID REFERENCES public.catalog_prices(id) ON DELETE SET NULL,
  gateway TEXT NOT NULL,
  gateway_payment_id TEXT NOT NULL,
  status public.billing_payment_status NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  method TEXT,
  failure_reason TEXT,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gateway, gateway_payment_id)
);
CREATE INDEX idx_billing_payments_user ON public.billing_payments(user_id, created_at DESC);
GRANT SELECT ON public.billing_payments TO authenticated;
GRANT ALL ON public.billing_payments TO service_role;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_payments_own_read" ON public.billing_payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "billing_payments_admin_all" ON public.billing_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---------- LEDGER (append-only) ----------
CREATE TABLE public.billing_ledger_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  customer_id UUID REFERENCES public.billing_customers(id) ON DELETE SET NULL,
  entry_type public.billing_ledger_entry_type NOT NULL,
  direction public.billing_ledger_direction NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  credits_delta INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER,
  source_type TEXT NOT NULL,
  source_id UUID,
  event_id UUID REFERENCES public.domain_events(id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  reverses_entry_id UUID REFERENCES public.billing_ledger_entries(id) ON DELETE SET NULL,
  actor_id UUID,
  memo TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_user ON public.billing_ledger_entries(user_id, created_at DESC);
-- append-only: no UPDATE/DELETE granted to anyone, including service_role
GRANT SELECT ON public.billing_ledger_entries TO authenticated;
GRANT SELECT, INSERT ON public.billing_ledger_entries TO service_role;
ALTER TABLE public.billing_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_own_read" ON public.billing_ledger_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ledger_admin_read" ON public.billing_ledger_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.billing_ledger_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'billing_ledger_entries is append-only';
END;
$$;
CREATE TRIGGER trg_ledger_no_update BEFORE UPDATE OR DELETE ON public.billing_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.billing_ledger_immutable();

CREATE OR REPLACE FUNCTION public.domain_events_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'domain_events is append-only';
END;
$$;
CREATE TRIGGER trg_events_no_update BEFORE UPDATE OR DELETE ON public.domain_events
  FOR EACH ROW EXECUTE FUNCTION public.domain_events_immutable();

-- ---------- DUNNING / COUPONS / SETTINGS / TIMELINE ----------
CREATE TABLE public.billing_dunning_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID NOT NULL REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  attempted_at TIMESTAMPTZ,
  outcome TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_dunning_attempts TO authenticated;
GRANT ALL ON public.billing_dunning_attempts TO service_role;
ALTER TABLE public.billing_dunning_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dunning_own_read" ON public.billing_dunning_attempts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "dunning_admin_all" ON public.billing_dunning_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT,
  percent_off NUMERIC(5,2),
  amount_off_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  duration TEXT NOT NULL DEFAULT 'once',
  duration_in_months INTEGER,
  trial_days_override INTEGER,
  max_redemptions INTEGER,
  redemptions INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  restricted_price_ids UUID[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_coupons TO authenticated;
GRANT ALL ON public.billing_coupons TO service_role;
ALTER TABLE public.billing_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_admin_all" ON public.billing_coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_coupon_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.billing_coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, user_id)
);
GRANT SELECT ON public.billing_coupon_redemptions TO authenticated;
GRANT ALL ON public.billing_coupon_redemptions TO service_role;
ALTER TABLE public.billing_coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupon_red_own_read" ON public.billing_coupon_redemptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "coupon_red_admin_all" ON public.billing_coupon_redemptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);
GRANT SELECT ON public.billing_settings TO authenticated;
GRANT ALL ON public.billing_settings TO service_role;
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_settings_admin_all" ON public.billing_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.billing_timeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.domain_events(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount_cents INTEGER,
  currency TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_timeline_user ON public.billing_timeline(user_id, occurred_at DESC);
GRANT SELECT ON public.billing_timeline TO authenticated;
GRANT ALL ON public.billing_timeline TO service_role;
ALTER TABLE public.billing_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "timeline_own_read" ON public.billing_timeline FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "timeline_admin_all" ON public.billing_timeline FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---------- updated_at triggers ----------
CREATE TRIGGER trg_catalog_products_u BEFORE UPDATE ON public.catalog_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_catalog_prices_u BEFORE UPDATE ON public.catalog_prices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_entitlement_grants_u BEFORE UPDATE ON public.entitlement_grants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_job_queue_u BEFORE UPDATE ON public.job_queue FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_billing_customers_u BEFORE UPDATE ON public.billing_customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_billing_pm_u BEFORE UPDATE ON public.billing_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_billing_subs_u BEFORE UPDATE ON public.billing_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_billing_invoices_u BEFORE UPDATE ON public.billing_invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_billing_payments_u BEFORE UPDATE ON public.billing_payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_billing_coupons_u BEFORE UPDATE ON public.billing_coupons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- resolver ----------
CREATE OR REPLACE FUNCTION public.resolve_entitlements(_user_id UUID)
RETURNS TABLE(feature_key TEXT, quota INTEGER, sources TEXT[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT g.feature_key,
         MAX(g.quota) AS quota,
         ARRAY_AGG(DISTINCT g.source::text) AS sources
  FROM public.entitlement_grants g
  WHERE g.user_id = _user_id
    AND g.revoked_at IS NULL
    AND (g.expires_at IS NULL OR g.expires_at > now())
  GROUP BY g.feature_key;
$$;
REVOKE EXECUTE ON FUNCTION public.resolve_entitlements(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_entitlements(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_feature(_user_id UUID, _feature TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entitlement_grants g
    WHERE g.user_id = _user_id AND g.feature_key = _feature
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_feature(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_feature(UUID, TEXT) TO authenticated, service_role;

-- =========================================================
-- SEED
-- =========================================================
INSERT INTO public.entitlement_features (key, name, description, is_quota) VALUES
  ('academy.access',      'Academia',              'Acesso aos cursos da Academia', false),
  ('academy.premium',     'Academia Premium',      'Acesso a cursos premium', false),
  ('lives.access',        'Lives',                 'Acesso às lives e salas interativas', false),
  ('lives.replay',        'Replays',               'Acesso às gravações das lives', false),
  ('community.access',    'Comunidade',            'Acesso à comunidade', false),
  ('shorts.publish',      'MM Shorts',             'Publicar vídeos curtos', false),
  ('ai.assistant',        'MM Intelligence',       'Assistente de IA', false),
  ('studio.access',       'MM Studio',             'Acesso ao MM Studio', false),
  ('studio.credits',      'Créditos MM Studio',    'Créditos para gerar conteúdo', true),
  ('events.access',       'Eventos',               'Acesso a eventos', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.billing_settings (key, value, description) VALUES
  ('dunning.retry_days', '[1,3,5]'::jsonb, 'Dias após falha em que se repete a tentativa de cobrança'),
  ('dunning.grace_period_days', '7'::jsonb, 'Dias de cortesia antes de suspender'),
  ('tax.default_rate', '23'::jsonb, 'Taxa de IVA por omissão (%)'),
  ('tax.default_country', '"PT"'::jsonb, 'País por omissão para efeitos fiscais'),
  ('invoice.number_prefix', '"MM"'::jsonb, 'Prefixo da numeração de faturas'),
  ('invoice.next_number', '1'::jsonb, 'Próximo número sequencial de fatura')
ON CONFLICT (key) DO NOTHING;

-- Catálogo inicial
INSERT INTO public.catalog_products (slug, kind, name, tagline, description, sort_order) VALUES
  ('mm_club', 'subscription', 'MM Club', 'A comunidade de empreendedores digitais.', 'Acesso completo à Academia, Lives, Comunidade e MM Intelligence.', 1),
  ('mm_credits_starter', 'credit_pack', 'Créditos Starter', 'Testa o motor.', '500 créditos MM Studio', 10),
  ('mm_credits_plus', 'credit_pack', 'Créditos Plus', 'Campanha semanal.', '1500 créditos MM Studio', 11),
  ('mm_credits_pro', 'credit_pack', 'Créditos Pro', 'Ritmo profissional.', '4000 créditos MM Studio', 12),
  ('mm_credits_max', 'credit_pack', 'Créditos Max', 'Escala total.', '10000 créditos MM Studio', 13)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.catalog_product_features (product_id, feature_key, quota)
SELECT p.id, f.key, NULL
FROM public.catalog_products p
CROSS JOIN (VALUES ('academy.access'),('academy.premium'),('lives.access'),('lives.replay'),
                   ('community.access'),('shorts.publish'),('ai.assistant'),('studio.access'),('events.access')) AS f(key)
WHERE p.slug = 'mm_club'
ON CONFLICT DO NOTHING;

INSERT INTO public.catalog_prices (product_id, slug, amount_cents, currency, interval, trial_days, grants_credits, display_label)
SELECT p.id, v.slug, v.amount, 'EUR', v.itv::public.catalog_price_interval, v.trial, v.credits, v.label
FROM public.catalog_products p
JOIN (VALUES
  ('mm_club',             'mm_club_monthly',      4900, 'month',    0,     0, '€49/mês'),
  ('mm_club',             'mm_club_yearly',      49000, 'year',     0,     0, '€490/ano'),
  ('mm_credits_starter',  'mm_credits_starter_v1', 990, 'one_time', 0,   500, '€9,90'),
  ('mm_credits_plus',     'mm_credits_plus_v1',   2490, 'one_time', 0,  1500, '€24,90'),
  ('mm_credits_pro',      'mm_credits_pro_v1',    4990, 'one_time', 0,  4000, '€49,90'),
  ('mm_credits_max',      'mm_credits_max_v1',    9990, 'one_time', 0, 10000, '€99,90')
) AS v(product_slug, slug, amount, itv, trial, credits, label) ON v.product_slug = p.slug
ON CONFLICT (slug) DO NOTHING;

-- =========================================================
-- LEGACY CLEANUP
-- =========================================================
DROP FUNCTION IF EXISTS public.has_active_subscription(uuid, text) CASCADE;
DROP TABLE IF EXISTS public.mm_credit_orders CASCADE;
DROP TABLE IF EXISTS public.mm_mollie_subscriptions CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.paddle_customers CASCADE;