ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text, 'blocked'::text]));

CREATE TABLE IF NOT EXISTS public.appointment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.appointment_status_history TO authenticated;
GRANT ALL ON public.appointment_status_history TO service_role;
ALTER TABLE public.appointment_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapist reads own appointment history" ON public.appointment_status_history;
CREATE POLICY "Therapist reads own appointment history"
  ON public.appointment_status_history
  FOR SELECT TO authenticated
  USING (public.is_therapist_owner(therapist_id));

CREATE OR REPLACE FUNCTION public.trg_crm_contact_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_phone text;
  v_first text;
  v_last text;
  v_contact_id uuid;
  v_when timestamptz;
BEGIN
  IF NEW.status = 'blocked' THEN
    NEW.client_id := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  v_email := NULLIF(lower(trim(COALESCE(NEW.patient_email, ''))), '');
  v_phone := NULLIF(regexp_replace(COALESCE(NEW.patient_phone, ''), '[^0-9]', '', 'g'), '');
  v_first := COALESCE(NULLIF(trim(split_part(COALESCE(NEW.patient_name, ''), ' ', 1)), ''), 'Client');
  v_last := COALESCE(NULLIF(trim(regexp_replace(COALESCE(NEW.patient_name, ''), '^\S+\s*', '')), ''), '');
  v_when := COALESCE(NEW.start_time, ((NEW.appointment_date::text || ' ' || COALESCE(NEW.appointment_time::text, '00:00:00'))::timestamp AT TIME ZONE 'Europe/Zurich'));

  v_contact_id := NEW.client_id;
  IF v_contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crm_client_contacts c
    WHERE c.id = v_contact_id AND c.therapist_id = NEW.therapist_id
  ) THEN
    v_contact_id := NULL;
  END IF;

  IF v_contact_id IS NULL AND v_email IS NOT NULL THEN
    SELECT c.id INTO v_contact_id
    FROM public.crm_client_contacts c
    WHERE c.therapist_id = NEW.therapist_id
      AND lower(trim(COALESCE(c.email, ''))) = v_email
    ORDER BY c.created_at ASC
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT c.id INTO v_contact_id
    FROM public.crm_client_contacts c
    WHERE c.therapist_id = NEW.therapist_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    ORDER BY c.created_at ASC
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    INSERT INTO public.crm_client_contacts (
      therapist_id, first_name, last_name, email, phone, session_type,
      relation_status, last_booking_at, next_booking_at, private_notes
    ) VALUES (
      NEW.therapist_id, v_first, v_last, v_email, NULLIF(trim(COALESCE(NEW.patient_phone, '')), ''),
      NEW.service_name,
      CASE WHEN NEW.status IN ('confirmed', 'completed') THEN 'active' ELSE 'new' END,
      CASE WHEN v_when <= now() THEN v_when ELSE NULL END,
      CASE WHEN v_when > now() AND NEW.status NOT IN ('cancelled', 'no_show') THEN v_when ELSE NULL END,
      'Créé automatiquement depuis un rendez-vous'
    ) RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.crm_client_contacts
    SET
      email = COALESCE(NULLIF(email, ''), v_email),
      phone = COALESCE(NULLIF(phone, ''), NULLIF(trim(COALESCE(NEW.patient_phone, '')), '')),
      session_type = COALESCE(NULLIF(NEW.service_name, ''), session_type),
      relation_status = CASE
        WHEN NEW.status IN ('confirmed', 'completed') AND relation_status IN ('prospect', 'new', 'followup') THEN 'active'
        ELSE relation_status
      END,
      last_booking_at = CASE
        WHEN v_when <= now() AND (last_booking_at IS NULL OR v_when > last_booking_at) THEN v_when
        ELSE last_booking_at
      END,
      next_booking_at = CASE
        WHEN NEW.status IN ('cancelled', 'no_show') AND next_booking_at = v_when THEN NULL
        WHEN v_when > now() AND NEW.status NOT IN ('cancelled', 'no_show')
          AND (next_booking_at IS NULL OR v_when < next_booking_at) THEN v_when
        ELSE next_booking_at
      END,
      updated_at = now()
    WHERE id = v_contact_id AND therapist_id = NEW.therapist_id;
  END IF;

  NEW.client_id := v_contact_id;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_crm_contact_from_appointment() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS appointment_to_crm_contact ON public.appointments;
DROP TRIGGER IF EXISTS trg_crm_contact_from_appointment ON public.appointments;
CREATE TRIGGER trg_crm_contact_from_appointment
  BEFORE INSERT OR UPDATE OF therapist_id, patient_name, patient_email, patient_phone, service_name, client_id, appointment_date, appointment_time, start_time, status
  ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_crm_contact_from_appointment();

CREATE OR REPLACE FUNCTION public.trg_appointment_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.appointment_status_history (
      appointment_id, therapist_id, previous_status, new_status, reason, changed_by
    ) VALUES (
      NEW.id,
      NEW.therapist_id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END,
      NEW.status,
      CASE WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason ELSE NULL END,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_appointment_status_history() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_appointment_status_history ON public.appointments;
CREATE TRIGGER trg_appointment_status_history
  AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_appointment_status_history();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_appointments_therapist_client ON public.appointments(therapist_id, client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_status_start ON public.appointments(therapist_id, status, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist_date_time ON public.appointments(therapist_id, appointment_date, appointment_time);
CREATE INDEX IF NOT EXISTS idx_appointment_status_history_appointment ON public.appointment_status_history(appointment_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_therapist_email_normalized ON public.crm_client_contacts(therapist_id, lower(trim(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_contacts_therapist_phone_normalized ON public.crm_client_contacts(therapist_id, regexp_replace(phone, '[^0-9]', '', 'g')) WHERE phone IS NOT NULL;