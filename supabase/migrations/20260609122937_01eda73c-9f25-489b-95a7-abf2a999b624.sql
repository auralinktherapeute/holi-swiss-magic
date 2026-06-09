
DROP POLICY IF EXISTS "Public create appointment" ON public.appointments;
CREATE POLICY "Public create appointment" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    appointment_date >= CURRENT_DATE
    AND length(patient_name) BETWEEN 1 AND 200
    AND patient_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.status = 'active')
  );
