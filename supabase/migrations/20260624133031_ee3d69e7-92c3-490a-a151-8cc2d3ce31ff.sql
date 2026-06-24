
CREATE POLICY "Therapists can read own assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'therapist-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Therapists can upload own assets"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'therapist-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Therapists can update own assets"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'therapist-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Therapists can delete own assets"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'therapist-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
