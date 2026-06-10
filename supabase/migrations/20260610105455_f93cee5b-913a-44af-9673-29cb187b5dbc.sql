DROP POLICY IF EXISTS "Admins read private therapist identifiers" ON public.therapist_private_identifiers;
CREATE POLICY "Admins read private therapist identifiers"
  ON public.therapist_private_identifiers
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));