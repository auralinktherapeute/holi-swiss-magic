-- Correctifs du contrôle de registre des certifications. Additif et idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'therapist_certifications_registry_source_chk') THEN
    ALTER TABLE public.therapist_certifications
      ADD CONSTRAINT therapist_certifications_registry_source_chk
      CHECK (
        registry_check_result IS DISTINCT FROM 'confirmed'
        OR (registry_check_source IS NOT NULL AND btrim(registry_check_source) <> '')
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.certification_verification_unchanged(
  _id uuid,
  _verification_status text,
  _verified_at timestamptz,
  _verified_by uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  select public.is_admin(auth.uid())
      or exists (
        select 1 from public.therapist_certifications c
        where c.id = _id
          and c.verification_status is not distinct from _verification_status
          and c.verified_at is not distinct from _verified_at
          and c.verified_by is not distinct from _verified_by
      )
      -- Retour à l'état déclaratif : jamais une élévation, toujours autorisé.
      or (coalesce(_verification_status, 'declared') = 'declared'
          and _verified_at is null
          and _verified_by is null);
$function$;

REVOKE EXECUTE ON FUNCTION public.certification_verification_unchanged(uuid, text, timestamptz, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.certification_verification_unchanged(uuid, text, timestamptz, uuid) TO authenticated, service_role;

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
      -- Invalidation du contrôle (tous les champs vidés) : autorisée, elle n'affirme rien.
      or exists (
        select 1 from public.therapist_certifications c
        where c.id = _id
          and _registry_check_result is null
          and _registry_check_source is null
          and _registry_checked_at is null
          and _registry_checked_by is null
          and c.declaration_accepted_at is not distinct from _declaration_accepted_at
          and c.declaration_version is not distinct from _declaration_version
      )
      or (not exists (select 1 from public.therapist_certifications c where c.id = _id)
          and _registry_check_result is null
          and _registry_check_source is null
          and _registry_checked_at is null
          and _registry_checked_by is null);
$function$;

REVOKE EXECUTE ON FUNCTION public.certification_admin_fields_unchanged(uuid, text, text, timestamptz, uuid, timestamptz, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.certification_admin_fields_unchanged(uuid, text, text, timestamptz, uuid, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.therapist_certifications_lock_verification()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_proof_changed boolean := false;
BEGIN
  NEW.updated_at := now();

  IF TG_OP = 'UPDATE' THEN
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
  END IF;

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

    IF TG_OP = 'UPDATE' THEN
      NEW.declaration_accepted_at := OLD.declaration_accepted_at;
      NEW.declaration_version := OLD.declaration_version;
    ELSE
      NEW.declaration_accepted_at := NULL;
      NEW.declaration_version := NULL;
    END IF;

    IF NEW.verification_status <> 'verified' OR NEW.registry_check_result IS NULL THEN
      NEW.registry_check_result := NULL;
      NEW.registry_check_source := NULL;
      NEW.registry_checked_at := NULL;
      NEW.registry_checked_by := NULL;
    ELSIF v_proof_changed THEN
      -- Preuve modifiée : la confirmation devient caduque, même pour un administrateur.
      NEW.registry_check_result := NULL;
      NEW.registry_check_source := NULL;
      NEW.registry_checked_at := NULL;
      NEW.registry_checked_by := NULL;
    ELSIF OLD IS NULL
       OR NEW.registry_check_result IS DISTINCT FROM OLD.registry_check_result
       OR NEW.registry_check_source IS DISTINCT FROM OLD.registry_check_source
       -- Contrôle refait à l'identique : l'appelant met la date à NULL pour
       -- demander un nouvel horodatage posé par la base.
       OR NEW.registry_checked_at IS NULL THEN
      NEW.registry_checked_at := now();
      NEW.registry_checked_by := auth.uid();
    ELSE
      NEW.registry_checked_at := OLD.registry_checked_at;
      NEW.registry_checked_by := OLD.registry_checked_by;
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
      NEW.declaration_accepted_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF v_proof_changed THEN
    NEW.verification_status := 'declared';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.source_label := NULL;
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