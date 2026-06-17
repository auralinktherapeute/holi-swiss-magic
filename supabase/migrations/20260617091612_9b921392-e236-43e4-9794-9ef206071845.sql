
-- 1. Therapists: stop exposing sensitive columns (ide, siret, user_id) to anon/authenticated.
-- Drop the public read policy on the base table; serve public reads through a column-restricted view.
DROP POLICY IF EXISTS "public read active therapists" ON public.therapists;

CREATE OR REPLACE VIEW public.therapists_public
WITH (security_invoker = off) AS
SELECT
  id, slug, first_name, last_name, title, short_bio, bio, photo_url,
  specialties, approaches, languages, address, postal_code, city, canton, country,
  latitude, longitude, consultation_modes, price_min, price_max, currency,
  insurance_accepted, email, phone, website, status, verified, ide_verified, siret_verified,
  meta_title, meta_description, created_at, updated_at, services, years_experience,
  google_reviews_url, accreditations
FROM public.therapists
WHERE status = 'active';

GRANT SELECT ON public.therapists_public TO anon, authenticated;

-- 2. Blocked periods: remove anon access to the `reason` column by dropping the broad SELECT policy.
-- Public booking widget already reads dates from the public_blocked_periods view.
DROP POLICY IF EXISTS "Public read blocked period dates" ON public.blocked_periods;
GRANT SELECT ON public.public_blocked_periods TO anon, authenticated;

-- 3. Articles: prevent non-admin authors from inserting/updating with a publication status.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='articles'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Therapists manage own articles" ON public.articles';
    EXECUTE $p$
      CREATE POLICY "Therapists manage own articles"
        ON public.articles FOR ALL
        TO authenticated
        USING (author_id = auth.uid())
        WITH CHECK (author_id = auth.uid() AND status IN ('draft', 'pending_validation'))
    $p$;
  END IF;
END $$;
