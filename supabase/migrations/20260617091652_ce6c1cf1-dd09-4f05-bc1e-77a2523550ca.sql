
-- Sensitive business IDs already live in therapist_private_identifiers; drop the duplicate
-- columns from public.therapists so they can never be exposed through the Data API.
ALTER TABLE public.therapists DROP COLUMN IF EXISTS ide;
ALTER TABLE public.therapists DROP COLUMN IF EXISTS siret;

-- The previous migration introduced a definer view as a stopgap; drop it now that
-- the base table no longer carries sensitive columns.
DROP VIEW IF EXISTS public.therapists_public;

-- Restore plain anon/authenticated read on active therapist rows.
CREATE POLICY "public read active therapists"
  ON public.therapists
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');
