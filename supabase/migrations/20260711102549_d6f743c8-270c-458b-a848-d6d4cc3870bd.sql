ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.therapists ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;