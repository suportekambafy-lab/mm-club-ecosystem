CREATE OR REPLACE FUNCTION public.can_access_live(_live_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.lives l
    WHERE l.id = _live_id
      AND (
        l.visibility = 'public'
        OR public.has_role(_user_id, 'admin')
        OR public.has_feature(_user_id, 'lives.access')
        OR public.has_feature(_user_id, 'lives.replay')
        OR EXISTS (
          SELECT 1 FROM public.user_entitlements ue
          WHERE ue.user_id = _user_id
            AND ue.entitlement::text IN ('club','premium','purchased')
        )
      )
  );
$function$;