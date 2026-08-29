DROP POLICY IF EXISTS "therapist documents: public files read" ON storage.objects;

CREATE POLICY "therapist documents: public files read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'therapist-documents'
  AND EXISTS (
    SELECT 1
    FROM public.therapist_documents td
    JOIN public.therapists t ON t.id = td.therapist_id
    WHERE td.is_public = true
      AND td.is_health_data = false
      AND td.doc_type = ANY (ARRAY['diplome'::text, 'brochure'::text])
      AND t.status = 'active'
      AND split_part(td.file_url, '/therapist-documents/', 2) = objects.name
  )
);