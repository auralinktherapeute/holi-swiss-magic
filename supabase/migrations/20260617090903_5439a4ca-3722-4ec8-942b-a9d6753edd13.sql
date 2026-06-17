
-- Owner read on therapist-photos so the user can preview their own photo
-- before the public read policy (which requires status='active') applies.
CREATE POLICY "therapist photos: owner read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'therapist-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
