
-- Public read access for course media and lesson videos
CREATE POLICY "Public read course-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-media');

CREATE POLICY "Public read lesson-videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lesson-videos');

-- Authenticated users can upload/update/delete
CREATE POLICY "Authenticated upload course-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-media');

CREATE POLICY "Authenticated update course-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-media');

CREATE POLICY "Authenticated delete course-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-media');

CREATE POLICY "Authenticated upload lesson-videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated update lesson-videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated delete lesson-videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lesson-videos');
