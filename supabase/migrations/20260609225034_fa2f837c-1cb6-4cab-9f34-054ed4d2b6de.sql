
-- Revoke broad UPDATE; re-grant only on self-manageable columns.
REVOKE UPDATE ON public.therapists FROM authenticated;

GRANT UPDATE (
  slug, first_name, last_name, title, short_bio, bio, photo_url,
  specialties, approaches, languages, address, postal_code, city, canton,
  country, latitude, longitude, consultation_modes, price_min, price_max,
  currency, insurance_accepted, email, phone, website, services,
  years_experience, google_reviews_url, accreditations, siret, ide,
  meta_title, meta_description, updated_at
) ON public.therapists TO authenticated;

GRANT ALL ON public.therapists TO service_role;
