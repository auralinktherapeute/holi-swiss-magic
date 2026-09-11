ALTER TABLE public.certification_organizations
  ADD COLUMN IF NOT EXISTS certification_label text,
  ADD COLUMN IF NOT EXISTS website_url text;