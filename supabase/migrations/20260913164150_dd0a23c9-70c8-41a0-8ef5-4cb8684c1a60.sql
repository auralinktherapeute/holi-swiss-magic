-- Lot 2 certifications : référence officielle facultative, trace du contrôle
-- registre réellement effectué par un administrateur, déclaration sur l'honneur.
-- Migration additive et idempotente.

ALTER TABLE public.therapist_certifications
  ADD COLUMN IF NOT EXISTS official_profile_url text,
  ADD COLUMN IF NOT EXISTS registry_check_result text,
  ADD COLUMN IF NOT EXISTS registry_check_source text,
  ADD COLUMN IF NOT EXISTS registry_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS registry_checked_by uuid,
  ADD COLUMN IF NOT EXISTS declaration_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS declaration_version text;

COMMENT ON COLUMN public.therapist_certifications.official_profile_url IS
  'Lien facultatif vers la fiche officielle ASCA/RME fourni par le thérapeute. Jamais récupéré côté serveur (aucun fetch).';
COMMENT ON COLUMN public.therapist_certifications.registry_check_result IS
  'Résultat du contrôle manuel effectué par un administrateur : confirmed | not_found | inconclusive.';
COMMENT ON COLUMN public.therapist_certifications.declaration_accepted_at IS
  'Horodatage serveur de l''acceptation de la déclaration sur l''honneur par le thérapeute.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'therapist_certifications_registry_result_chk') THEN
    ALTER TABLE public.therapist_certifications
      ADD CONSTRAINT therapist_certifications_registry_result_chk
      CHECK (registry_check_result IS NULL OR registry_check_result IN ('confirmed', 'not_found', 'inconclusive'));
  END IF;

  -- Domaines officiels exacts (ASCA, RME/EMR), HTTPS obligatoire, pas d'identifiants dans l'URL.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'therapist_certifications_official_url_chk') THEN
    ALTER TABLE public.therapist_certifications
      ADD CONSTRAINT therapist_certifications_official_url_chk
      CHECK (
        official_profile_url IS NULL
        OR (
          char_length(official_profile_url) <= 2000
          AND official_profile_url ~ '^https://(www\.)?(asca\.ch|rme\.ch|emr\.ch)(/|\?|$)'
        )
      );
  END IF;
END $$;

-- ------------------------------------------------------------------
-- Garde RLS : le thérapeute ne peut pas écrire les champs d'administration
-- (contrôle registre) ni forger sa déclaration.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.certification_admin_fields_unchanged(
  _id uuid,
  _registry_check_result text,
  _registry_check_source text,
  _registry_checked_at timestamptz,
  _registry_checked_by uuid,
  _declaration_accepted_at timestamptz,
  _declaration_version text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select public.is_admin(auth.uid())
      or exists (
        select 1 from public.therapist_certifications c
        where c.id = _id
          and c.registry_check_result is not distinct from _registry_check_result
          and c.registry_check_source is not distinct from _registry_check_source
          and c.registry_checked_at is not distinct from _registry_checked_at
          and c.registry_checked_by is not distinct from _registry_checked_by
          and c.declaration_accepted_at is not distinct from _declaration_accepted_at
          and c.declaration_version is not distinct from _declaration_version
      )
      -- Insertion : aucun résultat de contrôle ne peut naître avec la ligne.
      or (not exists (select 1 from public.therapist_certifications c where c.id = _id)
          and _registry_check_result is null
          and _registry_check_source is null
          and _registry_checked_at is null
          and _registry_checked_by is null);
$function$;

REVOKE EXECUTE ON FUNCTION public.certification_admin_fields_unchanged(uuid, text, text, timestamptz, uuid, timestamptz, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.certification_admin_fields_unchanged(uuid, text, text, timestamptz, uuid, timestamptz, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "certif owner insert" ON public.therapist_certifications;
CREATE POLICY "certif owner insert" ON public.therapist_certifications
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid())
    AND verification_status = 'declared'
    AND verified_at IS NULL
    AND verified_by IS NULL
    AND public.certification_admin_fields_unchanged(
      id, registry_check_result, registry_check_source, registry_checked_at, registry_checked_by,
      declaration_accepted_at, declaration_version)
  );

DROP POLICY IF EXISTS "certif owner update" ON public.therapist_certifications;
CREATE POLICY "certif owner update" ON public.therapist_certifications
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid()))
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid())
    AND public.certification_verification_unchanged(id, verification_status, verified_at, verified_by)
    AND public.certification_admin_fields_unchanged(
      id, registry_check_result, registry_check_source, registry_checked_at, registry_checked_by,
      declaration_accepted_at, declaration_version)
  );

-- ------------------------------------------------------------------
-- Trigger : horodatages posés par la base, confirmation jamais obsolète.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.therapist_certifications_lock_verification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_proof_changed boolean := false;
BEGIN
  NEW.updated_at := now();

  IF public.is_admin(auth.uid()) THEN
    IF NEW.verification_status = 'verified'
       AND (OLD IS NULL OR OLD.verification_status IS DISTINCT FROM 'verified') THEN
      NEW.verified_at := COALESCE(NEW.verified_at, now());
      NEW.verified_by := COALESCE(NEW.verified_by, auth.uid());
      NEW.rejected_at := NULL;
      NEW.rejected_by := NULL;
      NEW.rejection_reason := NULL;
    END IF;
    IF NEW.verification_status = 'rejected'
       AND (OLD IS NULL OR OLD.verification_status IS DISTINCT FROM 'rejected') THEN
      NEW.rejected_at := COALESCE(NEW.rejected_at, now());
      NEW.rejected_by := COALESCE(NEW.rejected_by, auth.uid());
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    END IF;
    IF NEW.verification_status IN ('declared','needs_information') THEN
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
      NEW.rejected_at := NULL;
      NEW.rejected_by := NULL;
    END IF;

    -- La déclaration sur l'honneur appartient au thérapeute : un administrateur
    -- ne peut ni la créer ni la modifier.
    IF TG_OP = 'UPDATE' THEN
      NEW.declaration_accepted_at := OLD.declaration_accepted_at;
      NEW.declaration_version := OLD.declaration_version;
    ELSE
      NEW.declaration_accepted_at := NULL;
      NEW.declaration_version := NULL;
    END IF;

    -- Contrôle registre : uniquement sur un justificatif déjà examiné,
    -- date et auteur posés par la base.
    IF NEW.verification_status <> 'verified' OR NEW.registry_check_result IS NULL THEN
      NEW.registry_check_result := NULL;
      NEW.registry_check_source := NULL;
      NEW.registry_checked_at := NULL;
      NEW.registry_checked_by := NULL;
    ELSIF OLD IS NULL
       OR NEW.registry_check_result IS DISTINCT FROM OLD.registry_check_result
       OR NEW.registry_check_source IS DISTINCT FROM OLD.registry_check_source THEN
      NEW.registry_checked_at := now();
      NEW.registry_checked_by := auth.uid();
    ELSE
      NEW.registry_checked_at := COALESCE(OLD.registry_checked_at, now());
      NEW.registry_checked_by := COALESCE(OLD.registry_checked_by, auth.uid());
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'declared';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.verification_note := NULL;
    NEW.source_label := NULL;
    NEW.registry_check_result := NULL;
    NEW.registry_check_source := NULL;
    NEW.registry_checked_at := NULL;
    NEW.registry_checked_by := NULL;
    IF NEW.declaration_version IS NULL OR btrim(NEW.declaration_version) = '' THEN
      NEW.declaration_version := NULL;
      NEW.declaration_accepted_at := NULL;
    ELSE
      -- Horodatage serveur : la date envoyée par le client est ignorée.
      NEW.declaration_accepted_at := now();
    END IF;
    RETURN NEW;
  END IF;

  v_proof_changed :=
       NEW.name IS DISTINCT FROM OLD.name
    OR NEW.issuer IS DISTINCT FROM OLD.issuer
    OR NEW.year IS DISTINCT FROM OLD.year
    OR NEW.file_url IS DISTINCT FROM OLD.file_url
    OR NEW.credential_type IS DISTINCT FROM OLD.credential_type
    OR NEW.registration_number IS DISTINCT FROM OLD.registration_number
    OR NEW.holder_name IS DISTINCT FROM OLD.holder_name
    OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR NEW.official_profile_url IS DISTINCT FROM OLD.official_profile_url;

  IF v_proof_changed THEN
    NEW.verification_status := 'declared';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.source_label := NULL;
    -- Une preuve modifiée ne peut pas laisser une confirmation de registre en place.
    NEW.registry_check_result := NULL;
    NEW.registry_check_source := NULL;
    NEW.registry_checked_at := NULL;
    NEW.registry_checked_by := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.rejected_at := OLD.rejected_at;
    NEW.rejected_by := OLD.rejected_by;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.source_label := OLD.source_label;
    NEW.registry_check_result := OLD.registry_check_result;
    NEW.registry_check_source := OLD.registry_check_source;
    NEW.registry_checked_at := OLD.registry_checked_at;
    NEW.registry_checked_by := OLD.registry_checked_by;
  END IF;
  NEW.verification_note := OLD.verification_note;
  NEW.declaration_accepted_at := OLD.declaration_accepted_at;
  NEW.declaration_version := OLD.declaration_version;
  RETURN NEW;
END $function$;
