ALTER TABLE public.availabilities ADD COLUMN IF NOT EXISTS specific_date DATE;
ALTER TABLE public.availabilities ALTER COLUMN day_of_week DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_availabilities_specific_date ON public.availabilities(therapist_id, specific_date) WHERE specific_date IS NOT NULL;