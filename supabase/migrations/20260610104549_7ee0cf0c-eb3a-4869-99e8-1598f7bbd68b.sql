DROP POLICY IF EXISTS "Public read occupied appointment slots" ON public.appointments;
DROP VIEW IF EXISTS public.public_appointment_slots;

REVOKE SELECT ON public.appointments FROM anon;
-- Keep authenticated table access for the existing therapist/patient row-level rules.
GRANT SELECT ON public.appointments TO authenticated;