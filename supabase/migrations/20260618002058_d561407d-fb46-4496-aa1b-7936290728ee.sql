
-- Remove sensitive tables from realtime broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.therapists;
ALTER PUBLICATION supabase_realtime DROP TABLE public.waiting_list;

-- Enforce column-level UPDATE privileges on therapists.
-- The trigger prevent_therapist_self_elevation already blocks elevation,
-- but defence in depth: revoke broad UPDATE and re-grant only editable columns.
REVOKE UPDATE ON public.therapists FROM authenticated;
GRANT UPDATE (
  first_name, last_name, title, short_bio, bio, photo_url,
  specialties, approaches, languages,
  address, postal_code, city, canton, country, latitude, longitude,
  consultation_modes, price_min, price_max, currency, insurance_accepted,
  email, phone, website,
  meta_title, meta_description,
  services, years_experience, google_reviews_url, accreditations, booking_note,
  updated_at
) ON public.therapists TO authenticated;
