
-- Recreate the public view with security_invoker = on so it respects the caller's RLS.
DROP VIEW IF EXISTS public.therapists_public;

CREATE VIEW public.therapists_public
WITH (security_invoker = on, security_barrier = true) AS
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

GRANT SELECT ON public.therapists_public TO anon, authenticated;
GRANT ALL    ON public.therapists_public TO service_role;

-- anon: column-level grant on the base table for the safe directory columns only.
-- Sensitive columns (email, phone, booking_note) are NOT granted to anon.
REVOKE ALL ON public.therapists FROM anon;
GRANT SELECT (
  id, user_id, slug, first_name, last_name, title, short_bio, bio,
  photo_url, specialties, approaches, languages, address, postal_code,
  city, canton, country, latitude, longitude, consultation_modes,
  price_min, price_max, currency, insurance_accepted, website, status,
  verified, services, years_experience, google_reviews_url,
  siret_verified, ide_verified, accreditations, meta_title, meta_description,
  created_at, updated_at
) ON public.therapists TO anon;

-- Policies so security_invoker view works for browsing the directory.
CREATE POLICY "anon read active therapists"
  ON public.therapists FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY "authenticated read active therapists"
  ON public.therapists FOR SELECT
  TO authenticated
  USING (status = 'active');
