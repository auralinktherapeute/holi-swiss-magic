CREATE OR REPLACE FUNCTION public.trg_notify_appointment_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_th record;
BEGIN
  SELECT first_name, last_name, slug, email
    INTO v_th
    FROM public.therapists
   WHERE id = NEW.therapist_id;

  PERFORM public.create_admin_notification(
    'appointment_new',
    'Nouvelle réservation',
    coalesce(NEW.patient_name,'patient') || ' — ' || NEW.appointment_date::text
      || coalesce(' à ' || to_char(NEW.appointment_time, 'HH24:MI'), '')
      || coalesce(' · ' || nullif(trim(coalesce(v_th.first_name,'') || ' ' || coalesce(v_th.last_name,'')),''), ''),
    '/admin',
    'appointment',
    NEW.id,
    jsonb_strip_nulls(jsonb_build_object(
      'patient_name',      NEW.patient_name,
      'patient_email',     NEW.patient_email,
      'patient_phone',     NEW.patient_phone,
      'appointment_date',  NEW.appointment_date::text,
      'appointment_time',  to_char(NEW.appointment_time, 'HH24:MI'),
      'status',            NEW.status,
      'notes',             NEW.notes,
      'therapist_name',    nullif(trim(coalesce(v_th.first_name,'') || ' ' || coalesce(v_th.last_name,'')), ''),
      'therapist_email',   v_th.email,
      'therapist_slug',    v_th.slug
    ))
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_notify_appointment_created() FROM public, anon, authenticated;

UPDATE public.notifications n
   SET entity_type = 'appointment',
       entity_id   = a.id,
       summary     = coalesce(a.patient_name,'patient') || ' — ' || a.appointment_date::text
                     || coalesce(' à ' || to_char(a.appointment_time,'HH24:MI'),'')
                     || coalesce(' · ' || nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')),''),''),
       data        = coalesce(n.data,'{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
                       'patient_name',     a.patient_name,
                       'patient_email',    a.patient_email,
                       'patient_phone',    a.patient_phone,
                       'appointment_date', a.appointment_date::text,
                       'appointment_time', to_char(a.appointment_time,'HH24:MI'),
                       'status',           a.status,
                       'notes',            a.notes,
                       'therapist_name',   nullif(trim(coalesce(t.first_name,'') || ' ' || coalesce(t.last_name,'')),''),
                       'therapist_email',  t.email,
                       'therapist_slug',   t.slug
                     ))
  FROM public.appointments a
  LEFT JOIN public.therapists t ON t.id = a.therapist_id
 WHERE n.kind = 'appointment_new'
   AND n.entity_id IS NULL
   AND a.created_at = n.created_at;