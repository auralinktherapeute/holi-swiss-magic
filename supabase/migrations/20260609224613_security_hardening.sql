-- 1) Restrict public read on therapists to non-sensitive columns
DROP POLICY IF EXISTS "public read active therapists" ON public.therapists;

REVOKE SELECT ON public.therapists FROM anon, authenticated;

GRANT SELECT (
  id, user_id, slug, first_name, last_name, title, short_bio, bio,
  photo_url, specialties, approaches, languages, address, postal_code,
  city, canton, country, latitude, longitude, consultation_modes,
  price_min, price_max, currency, insurance_accepted, email, phone,
  website, status, verified, services, years_experience,
  google_reviews_url, accreditations, meta_title, meta_description,
  created_at, updated_at, siret_verified, ide_verified
) ON public.therapists TO anon, authenticated;

CREATE POLICY "public read active therapists"
ON public.therapists
FOR SELECT
TO anon, authenticated
USING (status = 'active');

-- Authenticated owners still need full row access via existing "therapist manage own" policy.
-- Grant all columns to authenticated so owners can read their own siret/ide.
GRANT SELECT ON public.therapists TO authenticated;

-- 2) Tighten therapist-documents storage SELECT policy
DROP POLICY IF EXISTS "therapist documents: public read" ON storage.objects;

CREATE POLICY "therapist documents: public files read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'therapist-documents'
  AND EXISTS (
    SELECT 1 FROM public.therapist_documents td
    WHERE td.is_public = true
      AND td.file_url LIKE '%/' || storage.objects.name
  )
);

CREATE POLICY "therapist documents: owner read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'therapist-documents'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);
