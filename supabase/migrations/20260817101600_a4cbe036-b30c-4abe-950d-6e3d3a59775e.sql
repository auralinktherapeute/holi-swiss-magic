ALTER TABLE public.therapists
  ADD COLUMN IF NOT EXISTS newsletter_consent_source text,
  ADD COLUMN IF NOT EXISTS newsletter_consent_version text,
  ADD COLUMN IF NOT EXISTS newsletter_consent_email text;