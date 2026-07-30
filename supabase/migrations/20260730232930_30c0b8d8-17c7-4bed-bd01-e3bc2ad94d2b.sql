DROP POLICY IF EXISTS "Admin content readable by academy members and admins" ON public.admin_overrides;

CREATE POLICY "Catalogue overrides readable by everyone"
ON public.admin_overrides
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.admin_overrides TO anon, authenticated;
GRANT ALL ON public.admin_overrides TO service_role;