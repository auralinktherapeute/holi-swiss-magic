CREATE OR REPLACE FUNCTION public.trg_crm_contact_from_appointment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_phone text;
  v_first text;
  v_last text;
  v_contact_id uuid;
  v_when timestamptz;
  v_name_norm text;
BEGIN
  IF NEW.status = 'blocked' THEN
    NEW.client_id := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  v_email := NULLIF(lower(trim(COALESCE(NEW.patient_email, ''))), '');
  v_phone := NULLIF(regexp_replace(COALESCE(NEW.patient_phone, ''), '[^0-9]', '', 'g'), '');
  v_first := COALESCE(NULLIF(trim(split_part(regexp_replace(trim(COALESCE(NEW.patient_name, '')), '\s+', ' ', 'g'), ' ', 1)), ''), 'Client');
  v_last := COALESCE(NULLIF(trim(regexp_replace(regexp_replace(trim(COALESCE(NEW.patient_name, '')), '\s+', ' ', 'g'), '^\S+\s*', '')), ''), '');
  v_when := COALESCE(NEW.start_time, ((NEW.appointment_date::text || ' ' || COALESCE(NEW.appointment_time::text, '00:00:00'))::timestamp AT TIME ZONE 'Europe/Zurich'));
  v_name_norm := NULLIF(lower(public.immutable_unaccent(regexp_replace(trim(COALESCE(NEW.patient_name, '')), '\s+', ' ', 'g'))), '');

  v_contact_id := NEW.client_id;
  IF v_contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.crm_client_contacts c
    WHERE c.id = v_contact_id AND c.therapist_id = NEW.therapist_id
  ) THEN
    v_contact_id := NULL;
  END IF;

  IF v_contact_id IS NULL AND v_email IS NOT NULL THEN
    SELECT c.id INTO v_contact_id FROM public.crm_client_contacts c
    WHERE c.therapist_id = NEW.therapist_id AND lower(trim(COALESCE(c.email, ''))) = v_email
    ORDER BY c.created_at ASC LIMIT 1;
  END IF;

  IF v_contact_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT c.id INTO v_contact_id FROM public.crm_client_contacts c
    WHERE c.therapist_id = NEW.therapist_id
      AND regexp_replace(COALESCE(c.phone, ''), '[^0-9]', '', 'g') = v_phone
    ORDER BY c.created_at ASC LIMIT 1;
  END IF;

  -- Nom seul (rendez-vous saisi sans e-mail ni téléphone) : rattacher au client existant du même nom
  IF v_contact_id IS NULL AND v_email IS NULL AND v_phone IS NULL AND v_name_norm IS NOT NULL THEN
    SELECT c.id INTO v_contact_id FROM public.crm_client_contacts c
    WHERE c.therapist_id = NEW.therapist_id
      AND v_name_norm IN (
        lower(public.immutable_unaccent(regexp_replace(trim(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')), '\s+', ' ', 'g'))),
        lower(public.immutable_unaccent(regexp_replace(trim(COALESCE(c.last_name,'') || ' ' || COALESCE(c.first_name,'')), '\s+', ' ', 'g')))
      )
    ORDER BY c.created_at ASC LIMIT 1;
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
$function$;