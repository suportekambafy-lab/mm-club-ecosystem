-- ============ MM PRODUCT LAB ============
CREATE TABLE public.pl_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  image_url text,
  category text,
  status text NOT NULL DEFAULT 'found',
  sell_price numeric,
  cost_price numeric,
  market text,
  supplier text,
  supplier_url text,
  source text,
  product_url text,
  ad_url text,
  notes text,
  score integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_products TO authenticated;
GRANT ALL ON public.pl_products TO service_role;
ALTER TABLE public.pl_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_products own" ON public.pl_products FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pl_products_user_idx ON public.pl_products(user_id, created_at DESC);

CREATE TABLE public.pl_product_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pl_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criterion text NOT NULL,
  value integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, criterion)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_product_scores TO authenticated;
GRANT ALL ON public.pl_product_scores TO service_role;
ALTER TABLE public.pl_product_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_scores own" ON public.pl_product_scores FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pl_scores_product_idx ON public.pl_product_scores(product_id);

CREATE TABLE public.pl_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pl_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model text,
  content text NOT NULL,
  recommendation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_ai_analyses TO authenticated;
GRANT ALL ON public.pl_ai_analyses TO service_role;
ALTER TABLE public.pl_ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_ai own" ON public.pl_ai_analyses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pl_ai_product_idx ON public.pl_ai_analyses(product_id, created_at DESC);

CREATE TABLE public.pl_creative_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pl_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'image',
  url text,
  title text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_creative_assets TO authenticated;
GRANT ALL ON public.pl_creative_assets TO service_role;
ALTER TABLE public.pl_creative_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_assets own" ON public.pl_creative_assets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pl_assets_product_idx ON public.pl_creative_assets(product_id, created_at DESC);

CREATE TABLE public.pl_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pl_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text,
  screenshot_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_competitors TO authenticated;
GRANT ALL ON public.pl_competitors TO service_role;
ALTER TABLE public.pl_competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_competitors own" ON public.pl_competitors FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pl_competitors_product_idx ON public.pl_competitors(product_id, created_at DESC);

CREATE TABLE public.pl_product_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pl_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_product_notes TO authenticated;
GRANT ALL ON public.pl_product_notes TO service_role;
ALTER TABLE public.pl_product_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_notes own" ON public.pl_product_notes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pl_notes_product_idx ON public.pl_product_notes(product_id, created_at DESC);

CREATE TABLE public.pl_product_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.pl_products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pl_product_history TO authenticated;
GRANT ALL ON public.pl_product_history TO service_role;
ALTER TABLE public.pl_product_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pl_history own" ON public.pl_product_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX pl_history_product_idx ON public.pl_product_history(product_id, created_at DESC);

CREATE TRIGGER pl_products_updated_at BEFORE UPDATE ON public.pl_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pl_scores_updated_at BEFORE UPDATE ON public.pl_product_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pl_assets_updated_at BEFORE UPDATE ON public.pl_creative_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER pl_competitors_updated_at BEFORE UPDATE ON public.pl_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();