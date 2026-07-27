CREATE OR REPLACE FUNCTION public.handle_new_user_studio_credits()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- No free credits during signup/trial: the welcome bonus is granted by the
  -- billing engine on the first confirmed paid payment.
  INSERT INTO public.mm_studio_credits (user_id, balance, lifetime_granted)
  VALUES (NEW.id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;