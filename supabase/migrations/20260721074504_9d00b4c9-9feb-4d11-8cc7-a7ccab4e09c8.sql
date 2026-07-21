
DROP POLICY IF EXISTS "therapist insert own" ON public.therapists;
CREATE POLICY "therapist insert own"
ON public.therapists
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
  AND verified = false
  AND ide_verified = false
  AND siret_verified = false
);

DROP POLICY IF EXISTS "therapist update own editable profile" ON public.therapists;
CREATE POLICY "therapist update own editable profile"
ON public.therapists
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND status = (SELECT status FROM public.therapists WHERE id = therapists.id)
  AND verified = (SELECT verified FROM public.therapists WHERE id = therapists.id)
  AND ide_verified = (SELECT ide_verified FROM public.therapists WHERE id = therapists.id)
  AND siret_verified = (SELECT siret_verified FROM public.therapists WHERE id = therapists.id)
);

CREATE POLICY "admin manage therapists status"
ON public.therapists
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
