CREATE OR REPLACE FUNCTION public.grant_commercial_club_access(_user_id uuid, _months integer, _reason text) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid(); v_expiry timestamptz; v_source uuid := gen_random_uuid(); v_count integer;
BEGIN
 IF v_actor IS NULL OR NOT public.has_commercial_access(v_actor) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _months IS NOT NULL AND _months NOT IN (1,3,6,12) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 IF length(trim(coalesce(_reason,''))) < 3 OR length(_reason)>500 THEN RAISE EXCEPTION 'Reason required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id) THEN RAISE EXCEPTION 'Member not found'; END IF;
 v_expiry := CASE WHEN _months IS NULL THEN NULL ELSE now() + make_interval(months=>_months) END;
 INSERT INTO public.entitlement_grants(user_id,feature_key,source,source_id,quota,expires_at,metadata)
 SELECT _user_id,f.feature_key,'manual',v_source,max(f.quota),v_expiry,jsonb_build_object('actor_id',v_actor,'reason',trim(_reason),'months',_months,'lifetime',_months IS NULL,'origin','commercial')
 FROM public.catalog_product_features f JOIN public.catalog_products p ON p.id=f.product_id
 WHERE p.kind='subscription' AND EXISTS(SELECT 1 FROM public.catalog_product_features base WHERE base.product_id=p.id AND base.feature_key='academy.access') GROUP BY f.feature_key;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'Club features unavailable'; END IF;
 INSERT INTO public.admin_action_log(actor_id,action,entity_type,entity_id,"after") VALUES(v_actor,'commercial.grant_access','user',_user_id::text,jsonb_build_object('source_id',v_source,'expires_at',v_expiry,'months',_months,'lifetime',_months IS NULL,'reason',trim(_reason)));
 RETURN v_expiry;
END; $$;
REVOKE ALL ON FUNCTION public.grant_commercial_club_access(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_commercial_club_access(uuid,integer,text) TO authenticated;
COMMENT ON FUNCTION public.grant_commercial_club_access(uuid,integer,text) IS 'Authenticated commercial access: 1, 3, 6, 12 calendar months; NULL means lifetime. Every mapped club feature expires at the same instant; has_feature excludes expired grants without waiting for scheduled cleanup.';