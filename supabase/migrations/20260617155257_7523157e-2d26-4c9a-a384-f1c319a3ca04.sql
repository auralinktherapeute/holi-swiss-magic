
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_name TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'holiswiss';

UPDATE public.appointments
SET start_time = (appointment_date::text || ' ' || appointment_time::text)::timestamptz,
    end_time   = ((appointment_date::text || ' ' || appointment_time::text)::timestamptz
                  + (COALESCE(duration_minutes,60) || ' minutes')::interval)
WHERE start_time IS NULL AND appointment_date IS NOT NULL AND appointment_time IS NOT NULL;

ALTER TABLE public.appointments
  ALTER COLUMN appointment_date DROP NOT NULL,
  ALTER COLUMN appointment_time DROP NOT NULL,
  ALTER COLUMN patient_email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS appointments_therapist_start_idx
  ON public.appointments (therapist_id, start_time);
