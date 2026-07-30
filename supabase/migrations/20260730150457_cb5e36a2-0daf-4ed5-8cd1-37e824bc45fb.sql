insert into public.catalog_prices (product_id, slug, version, amount_cents, currency, interval, interval_count, trial_days, grants_credits, display_label, active)
values ('ca2e248c-d124-4e3c-8816-858a63a62842','mm_club_trial14',1,2990,'EUR','month',1,14,0,'MM Club — 14 dias grátis',true)
on conflict do nothing;