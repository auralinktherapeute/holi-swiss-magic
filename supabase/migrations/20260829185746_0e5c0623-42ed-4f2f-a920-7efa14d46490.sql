-- 1. Colonnes de décision
ALTER TABLE public.therapist_certifications
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS verification_note text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.therapist_certifications'::regclass
      AND conname = 'therapist_certifications_status_check'
  ) THEN
    ALTER TABLE public.therapist_certifications
      ADD CONSTRAINT therapist_certifications_status_check
      CHECK (verification_status IN ('declared','verified','rejected','needs_information'));
  END IF;
END $$;

-- 2. Historique de modération
CREATE TABLE IF NOT EXISTS public.diploma_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diploma_id uuid NOT NULL REFERENCES public.therapist_certifications(id) ON DELETE CASCADE,
  therapist_id uuid,
  previous_status text,
  new_status text NOT NULL,
  action_type text NOT NULL,
  reason text,
  note text,
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diploma_verification_history_diploma_idx
  ON public.diploma_verification_history (diploma_id, performed_at DESC);

GRANT SELECT ON public.diploma_verification_history TO authenticated;
GRANT ALL ON public.diploma_verification_history TO service_role;

ALTER TABLE public.diploma_verification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diploma_history_admin_read" ON public.diploma_verification_history;
CREATE POLICY "diploma_history_admin_read"
  ON public.diploma_verification_history FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "diploma_history_owner_read" ON public.diploma_verification_history;
CREATE POLICY "diploma_history_owner_read"
  ON public.diploma_verification_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.therapists t
    WHERE t.id = diploma_verification_history.therapist_id
      AND t.user_id = auth.uid()
  ));

-- 3. Verrouillage des champs de décision + horodatage
CREATE OR REPLACE FUNCTION public.therapist_certifications_lock_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    RETURN NEW;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.issuer IS DISTINCT FROM OLD.issuer
     OR NEW.year IS DISTINCT FROM OLD.year
     OR NEW.file_url IS DISTINCT FROM OLD.file_url THEN
    NEW.verification_status := 'declared';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejected_at := NULL;
    NEW.rejected_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.source_label := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.verified_at := OLD.verified_at;
    NEW.verified_by := OLD.verified_by;
    NEW.rejected_at := OLD.rejected_at;
    NEW.rejected_by := OLD.rejected_by;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.source_label := OLD.source_label;
  END IF;
  NEW.verification_note := OLD.verification_note;
  RETURN NEW;
END $function$;

-- 4. Journalisation automatique des décisions
CREATE OR REPLACE FUNCTION public.log_diploma_verification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.verification_status IS NOT DISTINCT FROM OLD.verification_status THEN
    RETURN NEW;
  END IF;

  v_action := CASE
    WHEN NEW.verification_status = 'verified' THEN 'verification'
    WHEN NEW.verification_status = 'rejected' THEN 'refus'
    WHEN NEW.verification_status = 'needs_information' THEN 'demande_informations'
    WHEN TG_OP = 'UPDATE' AND OLD.verification_status = 'verified' THEN 'revocation'
    WHEN TG_OP = 'INSERT' THEN 'soumission'
    ELSE 'retour_en_attente'
  END;

  INSERT INTO public.diploma_verification_history
    (diploma_id, therapist_id, previous_status, new_status, action_type, reason, note, performed_by)
  VALUES (
    NEW.id,
    NEW.therapist_id,
    CASE WHEN TG_OP = 'UPDATE' THEN OLD.verification_status ELSE NULL END,
    NEW.verification_status,
    v_action,
    NEW.rejection_reason,
    NEW.verification_note,
    auth.uid()
  );
  RETURN NEW;
END $function$;

REVOKE EXECUTE ON FUNCTION public.log_diploma_verification_change() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_log_diploma_verification ON public.therapist_certifications;
CREATE TRIGGER trg_log_diploma_verification
  AFTER INSERT OR UPDATE ON public.therapist_certifications
  FOR EACH ROW EXECUTE FUNCTION public.log_diploma_verification_change();