
DROP POLICY IF EXISTS "club/premium lives readable by entitled users" ON public.lives;
DROP POLICY IF EXISTS "public lives readable by all" ON public.lives;
DROP POLICY IF EXISTS "subscribers see all lives" ON public.lives;

CREATE POLICY "public lives readable by all"
  ON public.lives FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "subscribers see all lives"
  ON public.lives FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_active_subscription(auth.uid(), 'live')
    OR public.has_active_subscription(auth.uid(), 'sandbox')
    OR EXISTS (
      SELECT 1 FROM public.user_entitlements ue
      WHERE ue.user_id = auth.uid()
        AND ue.entitlement::text IN ('club','premium','purchased')
    )
  );

CREATE OR REPLACE FUNCTION public.can_access_live(_live_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lives l
    WHERE l.id = _live_id
      AND (
        l.visibility = 'public'
        OR public.has_role(_user_id, 'admin')
        OR public.has_active_subscription(_user_id, 'live')
        OR public.has_active_subscription(_user_id, 'sandbox')
        OR EXISTS (
          SELECT 1 FROM public.user_entitlements ue
          WHERE ue.user_id = _user_id
            AND ue.entitlement::text IN ('club','premium','purchased')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_entitlements (user_id, entitlement, source)
  VALUES
    (NEW.id, 'public'::content_visibility, 'signup'),
    (NEW.id, 'club'::content_visibility, 'signup'),
    (NEW.id, 'premium'::content_visibility, 'signup')
  ON CONFLICT (user_id, entitlement) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

INSERT INTO public.user_entitlements (user_id, entitlement, source)
SELECT u.id, 'club'::content_visibility, 'backfill' FROM auth.users u
ON CONFLICT (user_id, entitlement) DO NOTHING;

INSERT INTO public.user_entitlements (user_id, entitlement, source)
SELECT u.id, 'premium'::content_visibility, 'backfill' FROM auth.users u
ON CONFLICT (user_id, entitlement) DO NOTHING;

INSERT INTO public.subscriptions (
  user_id, paddle_subscription_id, paddle_customer_id,
  product_id, price_id, status,
  current_period_start, current_period_end, environment
) VALUES
  ('e78f7368-de84-4550-aefc-1d5c41192c86', 'manual_annual_live', 'manual_customer',
   'annual_plan', 'annual_yearly', 'active',
   now(), now() + interval '1 year', 'live'),
  ('e78f7368-de84-4550-aefc-1d5c41192c86', 'manual_annual_sandbox', 'manual_customer',
   'annual_plan', 'annual_yearly', 'active',
   now(), now() + interval '1 year', 'sandbox')
ON CONFLICT (paddle_subscription_id) DO NOTHING;
