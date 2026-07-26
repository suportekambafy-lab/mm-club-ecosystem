UPDATE public.catalog_prices
SET metadata = metadata || jsonb_build_object('test_mode', true, 'original_amount_cents', COALESCE((metadata->>'original_amount_cents')::int, amount_cents)),
    amount_cents = 100,
    updated_at = now()
WHERE amount_cents <> 100;