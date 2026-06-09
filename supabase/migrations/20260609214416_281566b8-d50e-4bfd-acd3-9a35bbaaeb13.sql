
ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS ide text,
  ADD COLUMN IF NOT EXISTS ide_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accreditations jsonb NOT NULL DEFAULT '[]'::jsonb;
