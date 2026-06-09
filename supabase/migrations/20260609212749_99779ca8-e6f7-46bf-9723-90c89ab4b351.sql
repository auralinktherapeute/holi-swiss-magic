
-- Allow signed-in users to manage objects in their own folder (folder name = auth user id)
CREATE POLICY "therapist photos: owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'therapist-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "therapist photos: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'therapist-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "therapist photos: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'therapist-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "therapist photos: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'therapist-photos');

CREATE POLICY "therapist documents: owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'therapist-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "therapist documents: owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'therapist-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "therapist documents: owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'therapist-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "therapist documents: public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'therapist-documents');
