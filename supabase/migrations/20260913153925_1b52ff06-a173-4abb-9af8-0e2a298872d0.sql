-- ============================================================
-- LOT 1 SÉCURITÉ — durcissement RLS therapists / therapist_certifications
-- ============================================================

-- ---------- 1. public.therapists : UPDATE ----------
-- AVANT :
--   "therapist cannot self-verify"        UPDATE authenticated USING (true)
--                                         WITH CHECK therapists_admin_fields_unchanged(...)
--   "therapist update own editable profile" UPDATE authenticated USING (user_id = auth.uid())
--                                         WITH CHECK (user_id = auth.uid())
-- Les politiques permissives se combinant par OR :
--   USING      -> true OR owner              = TOUTE ligne modifiable
--   WITH CHECK -> unchanged OR owner         = le propriétaire peut modifier
--                                              status/verified/subscription_plan
-- APRÈS : une seule politique propriétaire cumulant les deux garde-fous (AND).

DROP POLICY IF EXISTS "therapist cannot self-verify" ON public.therapists;
DROP POLICY IF EXISTS "therapist update own editable profile" ON public.therapists;

CREATE POLICY "therapist update own profile only"
ON public.therapists
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND public.therapists_admin_fields_unchanged(
    id, status, verified, ide_verified, siret_verified, subscription_plan
  )
);

-- "admin manage therapists status" (UPDATE, has_role(admin)) : conservée telle quelle.

-- ---------- 2. public.therapist_certifications ----------
-- AVANT :
--   "certif verification admin only" ALL authenticated USING (true)
--        WITH CHECK certification_verification_unchanged(...)
--   "certif_owner_write"             ALL public        USING/CHECK (admin OR owner)
--   "certif_public_read"             SELECT public     USING (therapist actif)
-- Combinaison OR sur USING -> true : n'importe quel utilisateur connecté pouvait
-- lire, modifier et SUPPRIMER (DELETE n'a pas de WITH CHECK) toute certification.
-- APRÈS : politiques séparées par opération, sans aucun USING(true).

DROP POLICY IF EXISTS "certif verification admin only" ON public.therapist_certifications;
DROP POLICY IF EXISTS "certif_owner_write" ON public.therapist_certifications;

-- Lecture : la règle publique existante "certif_public_read" est conservée.
-- Lecture de ses propres certifications (y compris thérapeute non actif).
CREATE POLICY "certif owner read"
ON public.therapist_certifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_certifications.therapist_id
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "certif admin read"
ON public.therapist_certifications
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Écritures propriétaire.
CREATE POLICY "certif owner insert"
ON public.therapist_certifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_certifications.therapist_id
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "certif owner update"
ON public.therapist_certifications
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_certifications.therapist_id
      AND t.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_certifications.therapist_id
      AND t.user_id = auth.uid()
  )
  AND public.certification_verification_unchanged(
    id, verification_status, verified_at, verified_by
  )
);

CREATE POLICY "certif owner delete"
ON public.therapist_certifications
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_certifications.therapist_id
      AND t.user_id = auth.uid()
  )
);

-- Administration (dont les champs de vérification).
CREATE POLICY "certif admin insert"
ON public.therapist_certifications
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "certif admin update"
ON public.therapist_certifications
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "certif admin delete"
ON public.therapist_certifications
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));
