ALTER TABLE public.therapist_certifications
  ADD COLUMN IF NOT EXISTS credential_type text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS holder_name text;

COMMENT ON COLUMN public.therapist_certifications.credential_type IS 'Type/organisme déclaré : asca | rme | federal | other. Déclaratif, ne vaut pas validation.';
COMMENT ON COLUMN public.therapist_certifications.registration_number IS 'Numéro d''enregistrement ou de certification (optionnel).';
COMMENT ON COLUMN public.therapist_certifications.holder_name IS 'Nom exact figurant sur le document justificatif.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.therapist_certifications'::regclass
      AND conname = 'therapist_certifications_credential_type_chk'
  ) THEN
    ALTER TABLE public.therapist_certifications
      ADD CONSTRAINT therapist_certifications_credential_type_chk
      CHECK (credential_type IS NULL OR credential_type = ANY (ARRAY['asca','rme','federal','other']));
  END IF;
END $$;