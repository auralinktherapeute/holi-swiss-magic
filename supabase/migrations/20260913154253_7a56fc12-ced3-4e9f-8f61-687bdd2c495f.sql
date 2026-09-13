-- ============================================================
-- LOT 1 SÉCURITÉ — correctif additif
-- ============================================================
-- Contexte vérifié en base avant écriture :
--   * verification_status : DEFAULT 'declared', NOT NULL
--   * CHECK autorisant 'declared' | 'verified' | 'rejected' | 'needs_information'
--     (+ second CHECK plus ancien : 'declared'|'verified'|'rejected'|'expired')
--     => le statut initial non vérifié est 'declared' (et non 'pending').
--   * verified_at / verified_by : nullable, sans défaut.
-- Le trigger therapist_certifications_lock_verification force déjà 'declared'
-- à l'INSERT pour un non-admin ; la policy ci-dessous ajoute la garantie au
-- niveau RLS (défense en profondeur, indépendante du trigger).

-- ---------- 1. INSERT propriétaire : statut initial imposé ----------
-- AVANT : "certif owner insert" WITH CHECK (propriété uniquement)
--         -> un thérapeute pouvait insérer verification_status='verified'
--            avec verified_at / verified_by renseignés.
-- APRÈS : propriété ET statut 'declared' ET verified_at/verified_by NULL.
DROP POLICY IF EXISTS "certif owner insert" ON public.therapist_certifications;

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
  AND verification_status = 'declared'
  AND verified_at IS NULL
  AND verified_by IS NULL
);

-- "certif admin insert" (WITH CHECK is_admin) : inchangée, non limitée.

-- ---------- 2. Lecture publique : uniquement les certifications validées ----------
-- AVANT : "certif_public_read" SELECT public USING (thérapeute actif)
--         -> exposait aussi les statuts 'declared', 'rejected', 'needs_information'.
--            Le handler public filtre déjà verification_status='verified' :
--            la RLS est alignée sur la promesse produit.
-- APRÈS : thérapeute actif ET verification_status = 'verified'.
-- Les politiques "certif owner read" et "certif admin read" couvrent les autres statuts.
DROP POLICY IF EXISTS "certif_public_read" ON public.therapist_certifications;

CREATE POLICY "certif_public_read"
ON public.therapist_certifications
FOR SELECT
USING (
  verification_status = 'verified'
  AND EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = therapist_certifications.therapist_id
      AND t.status = 'active'
  )
);
