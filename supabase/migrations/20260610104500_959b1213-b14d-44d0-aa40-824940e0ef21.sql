-- Harden direct execution of internal/security-definer functions.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE ALL ON FUNCTION public.prevent_therapist_self_elevation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_therapist_self_elevation() TO service_role;

REVOKE ALL ON FUNCTION public.waiting_list_count() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.waiting_list_count() TO service_role;

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;

-- Patients with an authenticated account can read appointments matching their own email.
DROP POLICY IF EXISTS "Patients read own appointments by email" ON public.appointments;
CREATE POLICY "Patients read own appointments by email"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (
    lower(patient_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Public availability must expose only occupied slots, never patient PII.
CREATE OR REPLACE VIEW public.public_appointment_slots
WITH (security_invoker = true, security_barrier = true) AS
SELECT
  therapist_id,
  appointment_date,
  appointment_time
FROM public.appointments
WHERE status IN ('pending', 'confirmed')
  AND appointment_date >= CURRENT_DATE;

GRANT SELECT ON public.public_appointment_slots TO anon, authenticated;
GRANT ALL ON public.public_appointment_slots TO service_role;

-- Expose occupied slots through the view without exposing patient details.
DROP POLICY IF EXISTS "Public read occupied appointment slots" ON public.appointments;
CREATE POLICY "Public read occupied appointment slots"
  ON public.appointments
  FOR SELECT
  TO anon, authenticated
  USING (
    status IN ('pending', 'confirmed')
    AND appointment_date >= CURRENT_DATE
    AND EXISTS (
      SELECT 1
      FROM public.therapists t
      WHERE t.id = appointments.therapist_id
        AND t.status = 'active'
    )
  );

-- Public photo reads are restricted to the active therapist profile that references the object.
DROP POLICY IF EXISTS "therapist photos: public read" ON storage.objects;
CREATE POLICY "therapist photos: public read"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'therapist-photos'
    AND EXISTS (
      SELECT 1
      FROM public.therapists t
      WHERE t.status = 'active'
        AND t.photo_url LIKE ('%/' || storage.objects.name)
    )
  );