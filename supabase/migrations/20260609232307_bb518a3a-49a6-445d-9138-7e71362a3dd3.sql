REVOKE ALL ON public.therapist_private_identifiers FROM PUBLIC;
REVOKE ALL ON public.therapist_private_identifiers FROM anon;
REVOKE ALL ON public.therapist_private_identifiers FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_private_identifiers TO authenticated;
GRANT ALL ON public.therapist_private_identifiers TO service_role;

DROP POLICY IF EXISTS "therapist update own editable profile" ON public.therapists;
CREATE POLICY "therapist update own editable profile"
ON public.therapists
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());