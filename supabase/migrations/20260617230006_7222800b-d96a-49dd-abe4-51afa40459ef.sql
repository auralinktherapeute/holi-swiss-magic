
DROP POLICY IF EXISTS "Public read event images" ON storage.objects;
CREATE POLICY "Public read event images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'event-images');

DROP POLICY IF EXISTS "Auth upload event images" ON storage.objects;
CREATE POLICY "Auth upload event images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth update own event images" ON storage.objects;
CREATE POLICY "Auth update own event images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth delete own event images" ON storage.objects;
CREATE POLICY "Auth delete own event images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-images' AND (storage.foldername(name))[1] = auth.uid()::text);
