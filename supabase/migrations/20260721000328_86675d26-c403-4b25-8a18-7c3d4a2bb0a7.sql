
-- Storage policies for studio-media (path pattern: <user_id>/...)
CREATE POLICY "studio_media_owner_select" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'studio-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "studio_media_owner_insert" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'studio-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "studio_media_owner_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'studio-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "studio_media_owner_delete" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'studio-media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Silence definer-function linter for our trigger function
REVOKE ALL ON FUNCTION public.handle_new_user_studio_credits() FROM PUBLIC, anon, authenticated;
