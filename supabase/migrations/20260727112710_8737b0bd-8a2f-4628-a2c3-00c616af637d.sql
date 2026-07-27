DROP POLICY IF EXISTS "admin_overrides readable by admins" ON public.admin_overrides;

CREATE POLICY "Admin content readable by academy members and admins"
ON public.admin_overrides
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_feature(auth.uid(), 'academy.access')
);