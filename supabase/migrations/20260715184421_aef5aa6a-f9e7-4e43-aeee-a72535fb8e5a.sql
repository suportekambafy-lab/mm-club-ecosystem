
CREATE POLICY "community-media authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'community-media');

CREATE POLICY "community-media authenticated upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'community-media' AND owner = auth.uid());

CREATE POLICY "community-media owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'community-media' AND owner = auth.uid());
