CREATE OR REPLACE FUNCTION public.has_commercial_access(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role::text IN ('admin','sdr','closer')); $$;
REVOKE ALL ON FUNCTION public.has_commercial_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_commercial_access(uuid) TO authenticated, service_role;
CREATE POLICY "Commercial team reads applications" ON public.leads FOR SELECT TO authenticated USING(public.has_commercial_access(auth.uid()));
CREATE OR REPLACE FUNCTION public.grant_commercial_club_access(_user_id uuid, _months integer, _reason text) RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid := auth.uid(); v_expiry timestamptz; v_source uuid := gen_random_uuid(); v_count integer;
BEGIN
 IF v_actor IS NULL OR NOT public.has_commercial_access(v_actor) THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _months NOT IN (3,6,12) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
 IF length(trim(coalesce(_reason,''))) < 3 OR length(_reason)>500 THEN RAISE EXCEPTION 'Reason required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id) THEN RAISE EXCEPTION 'Member not found'; END IF;
 v_expiry := now() + make_interval(months=>_months);
 INSERT INTO public.entitlement_grants(user_id,feature_key,source,source_id,quota,expires_at,metadata)
 SELECT _user_id,f.feature_key,'manual',v_source,max(f.quota),v_expiry,jsonb_build_object('actor_id',v_actor,'reason',trim(_reason),'months',_months,'origin','commercial')
 FROM public.catalog_product_features f JOIN public.catalog_products p ON p.id=f.product_id
 WHERE p.kind='subscription' AND EXISTS(SELECT 1 FROM public.catalog_product_features base WHERE base.product_id=p.id AND base.feature_key='academy.access') GROUP BY f.feature_key;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count=0 THEN RAISE EXCEPTION 'Club features unavailable'; END IF;
 INSERT INTO public.admin_action_log(actor_id,action,entity_type,entity_id,"after") VALUES(v_actor,'commercial.grant_access','user',_user_id::text,jsonb_build_object('source_id',v_source,'expires_at',v_expiry,'months',_months,'reason',trim(_reason)));
 RETURN v_expiry;
END; $$;
REVOKE ALL ON FUNCTION public.grant_commercial_club_access(uuid,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grant_commercial_club_access(uuid,integer,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_commercial_role(_user_id uuid,_role text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _role NOT IN ('sdr','closer','none') THEN RAISE EXCEPTION 'Invalid role'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user_id) THEN RAISE EXCEPTION 'Member not found'; END IF;
 DELETE FROM public.user_roles WHERE user_id=_user_id AND role::text IN ('sdr','closer');
 IF _role <> 'none' THEN INSERT INTO public.user_roles(user_id,role) VALUES(_user_id,_role::public.app_role) ON CONFLICT(user_id,role) DO NOTHING; END IF;
 INSERT INTO public.admin_action_log(actor_id,action,entity_type,entity_id,"after") VALUES(auth.uid(),'commercial.set_role','user',_user_id::text,jsonb_build_object('role',_role));
END; $$;
REVOKE ALL ON FUNCTION public.set_commercial_role(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_commercial_role(uuid,text) TO authenticated;