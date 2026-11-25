INSERT INTO public.entitlement_features(key,name,description) VALUES
 ('product.infoprodutos','MM Club Infoprodutos','Acesso aos cursos de Infoprodutos'),
 ('product.ia','MM Club IA','Acesso aos cursos de IA')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.mmpay_links ADD COLUMN IF NOT EXISTS unlocks_feature text REFERENCES public.entitlement_features(key);

CREATE OR REPLACE FUNCTION public.grant_mmpay_club_access(_user_id uuid, _payment_id uuid)
 RETURNS timestamp with time zone LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_expiry timestamptz := now() + make_interval(months=>6); v_existing timestamptz; v_feat text;
BEGIN
 SELECT l.unlocks_feature INTO v_feat FROM public.mmpay_payments p JOIN public.mmpay_links l ON l.id=p.link_id WHERE p.id=_payment_id;
 IF v_feat IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM public.entitlement_grants WHERE source='purchase' AND source_id=_payment_id) THEN
     INSERT INTO public.entitlement_grants(user_id,feature_key,source,source_id,expires_at,metadata)
     VALUES(_user_id,v_feat,'purchase',_payment_id,NULL,jsonb_build_object('origin','mmpay','payment_id',_payment_id,'addon',true));
   END IF;
   RETURN NULL;
 END IF;
 SELECT max(expires_at) INTO v_existing FROM public.entitlement_grants WHERE source='purchase' AND source_id=_payment_id;
 IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
 INSERT INTO public.entitlement_grants(user_id,feature_key,source,source_id,quota,expires_at,metadata)
 SELECT _user_id,f.feature_key,'purchase',_payment_id,max(f.quota),v_expiry,jsonb_build_object('origin','mmpay','months',6,'payment_id',_payment_id)
 FROM public.catalog_product_features f JOIN public.catalog_products p ON p.id=f.product_id
 WHERE p.kind='subscription' AND EXISTS(SELECT 1 FROM public.catalog_product_features base WHERE base.product_id=p.id AND base.feature_key='academy.access') GROUP BY f.feature_key;
 RETURN v_expiry;
END; $function$;