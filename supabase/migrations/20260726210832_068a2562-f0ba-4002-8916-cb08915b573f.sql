UPDATE public.catalog_prices SET amount_cents = v.cents, display_label = v.label
FROM (VALUES
  ('mm_club_monthly', 2990, 'MM Club Start'),
  ('mm_club_semestral', 14990, 'MM Club Plus'),
  ('mm_club_yearly', 24990, 'MM Club Elite'),
  ('mm_credits_starter_v1', 990, '€9,90'),
  ('mm_credits_plus_v1', 2490, '€24,90'),
  ('mm_credits_pro_v1', 4990, '€49,90'),
  ('mm_credits_max_v1', 9990, '€99,90')
) AS v(slug, cents, label)
WHERE catalog_prices.slug = v.slug;

INSERT INTO public.catalog_prices (product_id, slug, version, amount_cents, currency, interval, interval_count, trial_days, grants_credits, display_label, active)
SELECT p.id, 'mm_club_vip_trial', 1, 2990, 'EUR', 'month', 1, 90, 0, 'MM Club VIP — 3 meses grátis', true
FROM public.catalog_products p WHERE p.slug = 'mm_club'
ON CONFLICT (slug) DO UPDATE SET amount_cents = 2990, trial_days = 90, active = true;