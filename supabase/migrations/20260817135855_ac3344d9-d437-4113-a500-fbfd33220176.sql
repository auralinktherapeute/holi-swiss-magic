ALTER TABLE public.therapist_certifications
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'declared',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS expires_at date,
  ADD COLUMN IF NOT EXISTS source_label text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.therapist_certifications'::regclass
      AND conname = 'therapist_certifications_verification_status_chk'
  ) THEN
    ALTER TABLE public.therapist_certifications
      ADD CONSTRAINT therapist_certifications_verification_status_chk
      CHECK (verification_status IN ('declared','verified','rejected','expired'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.therapist_certifications_lock_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin(auth.uid()) THEN
    IF NEW.verification_status = 'verified' AND (OLD IS NULL OR OLD.verification_status IS DISTINCT FROM 'verified') THEN
      NEW.verified_at := COALESCE(NEW.verified_at, now());
      NEW.verified_by := COALESCE(NEW.verified_by, auth.uid());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'declared';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.source_label := NULL;
    RETURN NEW;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.issuer IS DISTINCT FROM OLD.issuer
     OR NEW.year IS DISTINCT FROM OLD.year
     OR NEW.file_url IS DISTINCT FROM OLD.file_url THEN
    NEW.verification_status := 'declared';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.source_label := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.source_label := OLD.source_label;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.therapist_certifications_lock_verification() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_therapist_certifications_lock_verification ON public.therapist_certifications;
CREATE TRIGGER trg_therapist_certifications_lock_verification
BEFORE INSERT OR UPDATE ON public.therapist_certifications
FOR EACH ROW EXECUTE FUNCTION public.therapist_certifications_lock_verification();

GRANT SELECT ON public.therapist_certifications TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_certifications TO authenticated;
GRANT ALL ON public.therapist_certifications TO service_role;