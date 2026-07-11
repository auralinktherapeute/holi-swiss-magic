-- 1) Fix SUPA_function_search_path_mutable: set search_path on immutable_unaccent
ALTER FUNCTION public.immutable_unaccent(text) SET search_path = extensions, public;

-- 2) Fix SUPA_security_definer_view: enable security_invoker on public_blocked_periods
ALTER VIEW public.public_blocked_periods SET (security_invoker = on);

-- 3) Fix therapists_public_contact_exposure:
--    Revoke broad SELECT on therapists from anon/authenticated/PUBLIC,
--    then re-grant SELECT only on non-sensitive columns (excludes email + phone).
REVOKE SELECT ON public.therapists FROM PUBLIC;
REVOKE SELECT ON public.therapists FROM anon;
REVOKE SELECT ON public.therapists FROM authenticated;

GRANT SELECT (
  id, user_id, slug, first_name, last_name, title, short_bio, bio, photo_url,
  specialties, approaches, languages, address, postal_code, city, canton, country,
  latitude, longitude, consultation_modes, price_min, price_max, currency,
  insurance_accepted, website, status, verified, meta_title, meta_description,
  created_at, updated_at, services, years_experience, google_reviews_url,
  siret_verified, ide_verified, accreditations, booking_note, gallery_urls,
  subscription_plan, invoice_counter, logo_url, payment_link
) ON public.therapists TO anon, authenticated;

-- Preserve write privileges for authenticated (RLS row policies still enforce ownership)
GRANT INSERT, UPDATE, DELETE ON public.therapists TO authenticated;

-- 4) Provide a controlled way for the owner (or admin) to read their own email/phone
CREATE OR REPLACE FUNCTION public.get_my_therapist_contact()
RETURNS TABLE(id uuid, email text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.email, t.phone
  FROM public.therapists t
  WHERE t.user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_therapist_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_therapist_contact() TO authenticated;