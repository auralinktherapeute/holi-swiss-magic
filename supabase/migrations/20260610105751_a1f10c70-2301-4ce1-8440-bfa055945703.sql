REVOKE SELECT (reason) ON public.blocked_periods FROM anon, authenticated;

DROP POLICY IF EXISTS "Admins manage private therapist identifiers" ON public.therapist_private_identifiers;
CREATE POLICY "Admins manage private therapist identifiers"
  ON public.therapist_private_identifiers
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));