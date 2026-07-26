CREATE POLICY "members can read accessible lives"
ON public.lives FOR SELECT TO authenticated
USING (public.can_access_live(id, auth.uid()));