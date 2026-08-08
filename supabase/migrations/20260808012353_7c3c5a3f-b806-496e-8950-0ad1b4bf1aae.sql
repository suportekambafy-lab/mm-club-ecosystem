DROP POLICY IF EXISTS "Catalogue overrides readable by everyone" ON public.admin_overrides;

CREATE POLICY "Catalogue overrides readable by members"
ON public.admin_overrides
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.admin_overrides FROM anon;