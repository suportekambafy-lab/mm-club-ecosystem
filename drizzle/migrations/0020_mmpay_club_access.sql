CREATE OR REPLACE FUNCTION public.grant_mmpay_club_access(_user_id uuid, _payment_id uuid) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_expiry timestamptz := now() + make_interval(months=>6); v_existing timestamptz;
BEGIN
 SELECT max(expires_at) INTO v_existing FROM public.entitlement_grants WHERE source='purchase' AND source_id=_payment_id;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 INSERT INTO public.entitlement_grants(user_id,feature_key,source,source_id,quota,expires_at,metadata)
 SELECT _user_id,f.feature_key,'purchase',_payment_id,max(f.quota),v_expiry,jsonb_build_object('origin','mmpay','months',6,'payment_id',_payment_id)
 FROM public.catalog_product_features f JOIN public.catalog_products p ON p.id=f.product_id
 WHERE p.kind='subscription' AND EXISTS(SELECT 1 FROM public.catalog_product_features base WHERE base.product_id=p.id AND base.feature_key='academy.access') GROUP BY f.feature_key;
 RETURN v_expiry;
END; $$;
REVOKE ALL ON FUNCTION public.grant_mmpay_club_access(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_mmpay_club_access(uuid,uuid) TO service_role;