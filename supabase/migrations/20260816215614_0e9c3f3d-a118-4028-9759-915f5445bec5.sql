DROP POLICY IF EXISTS "certif_public_read" ON public.therapist_certifications;
CREATE POLICY "certif_public_read" ON public.therapist_certifications
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_certifications.therapist_id
      AND t.status = 'active'
  )
);

DROP POLICY IF EXISTS "media_public_read" ON public.therapist_media;
CREATE POLICY "media_public_read" ON public.therapist_media
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_media.therapist_id
      AND t.status = 'active'
  )
);