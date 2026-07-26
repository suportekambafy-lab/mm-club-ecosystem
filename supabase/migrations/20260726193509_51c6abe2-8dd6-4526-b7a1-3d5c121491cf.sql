CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_entity_id := coalesce((to_jsonb(OLD) ->> 'id'), NULL);
  ELSE
    v_entity_id := coalesce((to_jsonb(NEW) ->> 'id'), NULL);
  END IF;

  INSERT INTO public.admin_action_log (
    actor_id, action, entity_type, entity_id, before, after, result, request_id
  ) VALUES (
    auth.uid(),
    lower(TG_TABLE_NAME) || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'success',
    'db-trigger'
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_overrides','catalog_products','catalog_prices','catalog_product_features',
    'billing_coupons','billing_settings','user_roles','user_entitlements',
    'entitlement_grants','lives','security_settings','community_categories'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS audit_%1$s ON public.%1$s', t);
    EXECUTE format(
      'CREATE TRIGGER audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
       FOR EACH ROW EXECUTE FUNCTION public.audit_row_change()', t);
  END LOOP;
END $$;