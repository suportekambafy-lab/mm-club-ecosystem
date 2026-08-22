DROP FUNCTION IF EXISTS public.my_community_sanction();

CREATE FUNCTION public.my_community_sanction()
 RETURNS TABLE(id uuid, kind text, level integer, reason text, rule text, expires_at timestamp with time zone, permanent boolean, appeal_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.id, s.kind, s.level, s.reason, s.rule, s.expires_at, s.permanent,
         (SELECT a.status FROM public.moderation_appeals a
          WHERE a.sanction_id = s.id ORDER BY a.created_at DESC LIMIT 1) AS appeal_status
  FROM public.community_sanctions s
  WHERE s.user_id = auth.uid()
    AND s.lifted_at IS NULL
    AND s.kind IN ('mute','ban')
    AND (s.permanent OR s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY s.created_at DESC
  LIMIT 1;
$function$;