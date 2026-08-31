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
BEGIN
  v_email := NULLIF(lower(trim(COALESCE(NEW.patient_email, ''))), '');
  v_phone := NULLIF(regexp_replace(COALESCE(NEW.patient_phone, ''), '[^0-9+]', '', 'g'), '');
  v_first := NULLIF(trim(split_part(COALESCE(NEW.patient_name, ''), ' ', 1)), '');
  v_last := NULLIF(trim(regexp_replace(COALESCE(NEW.patient_name, ''), '^\S+\s*', '')), '');

  v_contact_id := NEW.client_id;

  IF v_contact_id IS NULL THEN
    IF v_email IS NOT NULL THEN
      SELECT id INTO v_contact_id
      FROM public.crm_client_contacts
      WHERE therapist_id = NEW.therapist_id
        AND lower(email) = v_email
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_contact_id IS NULL AND v_phone IS NOT NULL THEN
      SELECT id INTO v_contact_id
      FROM public.crm_client_contacts
      WHERE therapist_id = NEW.therapist_id
        AND regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = v_phone
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    IF v_contact_id IS NULL THEN
      INSERT INTO public.crm_client_contacts (
        therapist_id, first_name, last_name, email, phone, relation_status, private_notes
      ) VALUES (
        NEW.therapist_id,
        COALESCE(v_first, ''),
        COALESCE(v_last, ''),
        v_email,
        v_phone,
        'actif',
        'Créé automatiquement depuis un rendez-vous'
      )
      RETURNING id INTO v_contact_id;
    ELSE
      UPDATE public.crm_client_contacts
      SET
        email = COALESCE(NULLIF(email, ''), v_email),
        phone = COALESCE(NULLIF(phone, ''), v_phone),
        updated_at = now()
      WHERE id = v_contact_id;
    END IF;
  END IF;

  NEW.client_id := v_contact_id;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.trg_crm_contact_from_appointment() FROM public, anon, authenticated;