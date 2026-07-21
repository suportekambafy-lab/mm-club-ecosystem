
CREATE OR REPLACE FUNCTION public.mm_studio_grant_credits(
  _user_id UUID,
  _amount INT,
  _reason TEXT,
  _ref_key TEXT
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
  -- Idempotency: skip if a ledger row with the same ref_key already exists.
  SELECT EXISTS (
    SELECT 1 FROM public.mm_studio_credit_ledger
    WHERE user_id = _user_id AND reason = _reason AND meta->>'ref_key' = _ref_key
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

  INSERT INTO public.mm_studio_credit_ledger (user_id, delta, reason, meta)
  VALUES (_user_id, _amount, _reason, jsonb_build_object('ref_key', _ref_key));

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.mm_studio_grant_credits(UUID, INT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mm_studio_grant_credits(UUID, INT, TEXT, TEXT) TO service_role;
