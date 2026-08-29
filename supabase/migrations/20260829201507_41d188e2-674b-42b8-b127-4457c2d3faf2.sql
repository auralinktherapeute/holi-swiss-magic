CREATE OR REPLACE FUNCTION public.trg_crm_contact_from_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_elite boolean;
  v_user_id uuid;
  v_contact_id uuid;
  v_existing_id uuid;
  v_fn text;
  v_ln text;
BEGIN
  SELECT user_id, (subscription_plan = 'elite_pro')
    INTO v_user_id, v_is_elite
  FROM public.therapists WHERE id = NEW.therapist_id;

  IF NOT COALESCE(v_is_elite, false) THEN
    RETURN NEW;
  END IF;

  v_fn := split_part(COALESCE(NEW.patient_name,''), ' ', 1);
  v_ln := NULLIF(regexp_replace(COALESCE(NEW.patient_name,''), '^\S+\s*', ''), '');

  SELECT id INTO v_existing_id FROM public.crm_client_contacts
    WHERE therapist_id = NEW.therapist_id
      AND (
        (NEW.patient_email IS NOT NULL AND email = NEW.patient_email)
        OR (NEW.patient_email IS NULL AND first_name = v_fn AND COALESCE(last_name,'') = COALESCE(v_ln,''))
      )
    LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.crm_client_contacts (
      therapist_id, first_name, last_name, email, phone,
      session_type, relation_status, last_booking_at, next_booking_at
    ) VALUES (
      NEW.therapist_id, v_fn, v_ln, NEW.patient_email, NEW.patient_phone,
      NEW.service_name, 'nouveau_client', NEW.created_at, NEW.start_time
    ) RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.crm_client_contacts
      SET last_booking_at = GREATEST(COALESCE(last_booking_at, NEW.created_at), NEW.created_at),
          next_booking_at = CASE
            WHEN NEW.start_time > now() AND (next_booking_at IS NULL OR NEW.start_time < next_booking_at)
              THEN NEW.start_time
            ELSE next_booking_at END,
          relation_status = CASE
            WHEN relation_status IN ('prospect','nouveau_client') THEN 'client_actif'
            ELSE relation_status END,
          phone = COALESCE(phone, NEW.patient_phone),
          updated_at = now()
      WHERE id = v_existing_id
      RETURNING id INTO v_contact_id;
  END IF;

  IF v_contact_id IS NOT NULL AND NEW.client_id IS NULL THEN
    UPDATE public.appointments
      SET client_id = v_contact_id
      WHERE id = NEW.id AND client_id IS NULL;
  END IF;

  INSERT INTO public.crm_activities (
    entity_type, entity_id, therapist_id, owner_id, type, title, body, metadata, occurred_at
  ) VALUES (
    'contact', v_contact_id, NEW.therapist_id, v_user_id, 'booking',
    'Nouvelle réservation', NEW.service_name,
    jsonb_build_object('appointment_id', NEW.id, 'date', NEW.start_time),
    COALESCE(NEW.created_at, now())
  );

  RETURN NEW;
END $$;

UPDATE public.appointments a
SET client_id = c.id
FROM public.crm_client_contacts c
WHERE a.client_id IS NULL
  AND c.therapist_id = a.therapist_id
  AND a.patient_email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(c.email) = lower(a.patient_email);

UPDATE public.appointments a
SET client_id = c.id
FROM public.crm_client_contacts c
WHERE a.client_id IS NULL
  AND c.therapist_id = a.therapist_id
  AND lower(btrim(regexp_replace(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,''), '\s+', ' ', 'g')))
      = lower(btrim(regexp_replace(coalesce(a.patient_name,''), '\s+', ' ', 'g')));