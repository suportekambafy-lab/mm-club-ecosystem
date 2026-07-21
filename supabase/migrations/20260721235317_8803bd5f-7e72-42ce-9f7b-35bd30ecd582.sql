
CREATE OR REPLACE FUNCTION public.mm_studio_grant_credits(
  _user_id UUID,
  _amount INT,
  _reason TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INT;
  already_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.mm_studio_credit_ledger
    WHERE user_id = _user_id AND reason = _reason
  ) INTO already_exists;

  IF already_exists THEN
    SELECT balance INTO new_balance FROM public.mm_studio_credits WHERE user_id = _user_id;
    RETURN COALESCE(new_balance, 0);
  END IF;

  INSERT INTO public.mm_studio_credits (user_id, balance, lifetime_granted, lifetime_spent)
  VALUES (_user_id, _amount, _amount, 0)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.mm_studio_credits.balance + _amount,
        lifetime_granted = public.mm_studio_credits.lifetime_granted + _amount,
        updated_at = now()
  RETURNING balance INTO new_balance;

  INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason)
  VALUES (_user_id, _amount, _reason);

  RETURN new_balance;
END;
$$;

-- Drop the previous 4-arg version added earlier in this session.
DROP FUNCTION IF EXISTS public.mm_studio_grant_credits(UUID, INT, TEXT, TEXT);

REVOKE ALL ON FUNCTION public.mm_studio_grant_credits(UUID, INT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_studio_grant_credits(UUID, INT, TEXT) TO service_role;
