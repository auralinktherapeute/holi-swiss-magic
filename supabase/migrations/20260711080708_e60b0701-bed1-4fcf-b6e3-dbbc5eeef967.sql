
CREATE POLICY "Therapists can read own invoice files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'invoices'
  AND public.is_therapist_owner( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "Therapists can upload own invoice files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND public.is_therapist_owner( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "Therapists can update own invoice files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'invoices'
  AND public.is_therapist_owner( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "Therapists can delete own invoice files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'invoices'
  AND public.is_therapist_owner( ((storage.foldername(name))[1])::uuid )
);
