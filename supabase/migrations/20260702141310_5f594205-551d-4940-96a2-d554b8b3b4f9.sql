ALTER TABLE public.specialties
  ADD COLUMN IF NOT EXISTS description_de text,
  ADD COLUMN IF NOT EXISTS description_it text,
  ADD COLUMN IF NOT EXISTS description_en text;