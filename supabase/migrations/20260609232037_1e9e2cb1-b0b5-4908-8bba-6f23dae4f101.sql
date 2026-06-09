CREATE TABLE IF NOT EXISTS public.therapist_private_identifiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  siret text,
  ide text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (therapist_id),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapist_private_identifiers TO authenticated;
GRANT ALL ON public.therapist_private_identifiers TO service_role;

ALTER TABLE public.therapist_private_identifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Therapists manage own private identifiers" ON public.therapist_private_identifiers;
CREATE POLICY "Therapists manage own private identifiers"
ON public.therapist_private_identifiers
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.therapists t
    WHERE t.id = therapist_private_identifiers.therapist_id
      AND t.user_id = auth.uid()
  )
);

CREATE TRIGGER update_therapist_private_identifiers_updated_at
BEFORE UPDATE ON public.therapist_private_identifiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.therapist_private_identifiers (therapist_id, user_id, siret, ide)
SELECT id, user_id, siret, ide
FROM public.therapists
WHERE (siret IS NOT NULL OR ide IS NOT NULL)
ON CONFLICT (therapist_id) DO UPDATE
SET siret = EXCLUDED.siret,
    ide = EXCLUDED.ide,
    updated_at = now();

DROP POLICY IF EXISTS "therapist manage own" ON public.therapists;
DROP POLICY IF EXISTS "therapist read own" ON public.therapists;
DROP POLICY IF EXISTS "therapist insert own" ON public.therapists;
DROP POLICY IF EXISTS "therapist update own editable profile" ON public.therapists;
DROP POLICY IF EXISTS "therapist delete own" ON public.therapists;

REVOKE ALL ON public.therapists FROM anon;
REVOKE ALL ON public.therapists FROM authenticated;

GRANT SELECT (
  id, user_id, slug, first_name, last_name, title, short_bio, bio,
  photo_url, specialties, approaches, languages, address, postal_code,
  city, canton, country, latitude, longitude, consultation_modes,
  price_min, price_max, currency, insurance_accepted, email, phone,
  website, status, verified, services, years_experience,
  google_reviews_url, accreditations, meta_title, meta_description,
  created_at, updated_at, siret_verified, ide_verified
) ON public.therapists TO anon;

GRANT SELECT (
  id, user_id, slug, first_name, last_name, title, short_bio, bio,
  photo_url, specialties, approaches, languages, address, postal_code,
  city, canton, country, latitude, longitude, consultation_modes,
  price_min, price_max, currency, insurance_accepted, email, phone,
  website, status, verified, services, years_experience,
  google_reviews_url, accreditations, meta_title, meta_description,
  created_at, updated_at, siret_verified, ide_verified
) ON public.therapists TO authenticated;

GRANT INSERT (
  user_id, slug, first_name, last_name, title, short_bio, bio, photo_url,
  specialties, approaches, languages, address, postal_code, city, canton,
  country, latitude, longitude, consultation_modes, price_min, price_max,
  currency, insurance_accepted, email, phone, website, services,
  years_experience, google_reviews_url, accreditations, meta_title,
  meta_description
) ON public.therapists TO authenticated;

GRANT UPDATE (
  slug, first_name, last_name, title, short_bio, bio, photo_url,
  specialties, approaches, languages, address, postal_code, city, canton,
  country, latitude, longitude, consultation_modes, price_min, price_max,
  currency, insurance_accepted, email, phone, website, services,
  years_experience, google_reviews_url, accreditations, meta_title,
  meta_description, updated_at
) ON public.therapists TO authenticated;

GRANT DELETE ON public.therapists TO authenticated;
GRANT ALL ON public.therapists TO service_role;

CREATE POLICY "therapist read own"
ON public.therapists
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "therapist insert own"
ON public.therapists
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'active'::text
  AND verified = false
  AND ide_verified = false
  AND siret_verified = false
);

CREATE POLICY "therapist update own editable profile"
ON public.therapists
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND status = 'active'::text
  AND verified = false
  AND ide_verified = false
  AND siret_verified = false
);

CREATE POLICY "therapist delete own"
ON public.therapists
FOR DELETE
TO authenticated
USING (user_id = auth.uid());