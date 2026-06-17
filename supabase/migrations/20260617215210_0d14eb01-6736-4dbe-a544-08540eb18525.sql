
-- 1. Drop overly permissive public-read policy
DROP POLICY IF EXISTS "public read active therapists" ON public.therapists;

-- 2. Public-facing view exposing only safe directory columns
CREATE OR REPLACE VIEW public.therapists_public
WITH (security_invoker = off, security_barrier = true) AS
SELECT
  id, user_id, slug, first_name, last_name, title, short_bio, bio,
  photo_url, specialties, approaches, languages, address, postal_code,
  city, canton, country, latitude, longitude, consultation_modes,
  price_min, price_max, currency, insurance_accepted, website, status,
  verified, services, years_experience, google_reviews_url,
  siret_verified, ide_verified, accreditations, meta_title, meta_description,
  created_at, updated_at
FROM public.therapists
WHERE status = 'active';

-- 3. Revoke anon access to the base table; expose only the safe view
REVOKE SELECT ON public.therapists FROM anon;
GRANT SELECT ON public.therapists_public TO anon, authenticated;
GRANT ALL ON public.therapists_public TO service_role;
