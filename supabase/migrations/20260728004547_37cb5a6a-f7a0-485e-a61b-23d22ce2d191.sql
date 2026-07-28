-- 1) Trigger-only SECURITY DEFINER functions must not be callable through the API
REVOKE EXECUTE ON FUNCTION public.enforce_read_only() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_shorts_sync_comments_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mm_shorts_sync_likes_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_community_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_community_like() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_community_post() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_community_reaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_short_comment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_short_like() FROM PUBLIC, anon, authenticated;

-- 2) Live helpers are only used by policies for signed-in users
REVOKE EXECUTE ON FUNCTION public.can_access_live(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_live_cohost(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_live_publisher(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mm_short_increment_view(uuid) FROM PUBLIC, anon;

-- 3) Credit functions: a signed-in caller may only affect their own balance
CREATE OR REPLACE FUNCTION public.mm_studio_spend_credits(_user_id uuid, _amount integer, _reason text, _ref uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_balance INT;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE public.mm_studio_credits
  SET balance = balance - _amount,
      lifetime_spent = lifetime_spent + _amount,
      updated_at = now()
  WHERE user_id = _user_id AND balance >= _amount
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason, ref_id)
  VALUES (_user_id, -_amount, _reason, _ref);

  RETURN new_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mm_studio_refund_credits(_user_id uuid, _amount integer, _reason text, _ref uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_balance INT;
  spent INT;
BEGIN
  IF auth.uid() IS NOT NULL AND _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  -- Never refund more than what this reference actually consumed.
  SELECT COALESCE(-SUM(delta), 0) INTO spent
  FROM public.mm_studio_credit_ledger
  WHERE user_id = _user_id AND delta < 0
    AND (_ref IS NULL OR ref_id = _ref);

  IF _amount > spent THEN
    RAISE EXCEPTION 'refund exceeds spend';
  END IF;

  UPDATE public.mm_studio_credits
  SET balance = balance + _amount,
      lifetime_spent = GREATEST(0, lifetime_spent - _amount),
      updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO new_balance;

  INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason, ref_id)
  VALUES (_user_id, _amount, _reason, _ref);

  RETURN new_balance;
END;
$function$;

-- 4) Remove always-true write policies
DROP POLICY IF EXISTS "service role manages email log" ON public.email_log;

DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (
    email ~* '^[A-Za-z0-9._%%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND length(email) <= 254
    AND (source IS NULL OR length(source) <= 60)
  );

-- 5) Community media: readable by admins, the uploader, or members with community access
DROP POLICY IF EXISTS "community-media authenticated read" ON storage.objects;
CREATE POLICY "community-media member read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'community-media'
    AND (
      owner = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_feature(auth.uid(), 'community.access')
    )
  );