CREATE OR REPLACE FUNCTION public.notify_community_post()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Membros silenciados/banidos nunca geram notificações a partir dos posts.
  IF public.is_community_restricted(NEW.author_id) THEN
    RETURN NEW;
  END IF;
  PERFORM public.notify_mentions(NEW.content, NEW.author_id, NEW.id, NULL, NULL);
  RETURN NEW;
END; $function$;