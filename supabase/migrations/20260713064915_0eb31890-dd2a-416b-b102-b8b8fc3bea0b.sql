ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS meta_title_de text,
  ADD COLUMN IF NOT EXISTS meta_title_it text,
  ADD COLUMN IF NOT EXISTS meta_title_en text,
  ADD COLUMN IF NOT EXISTS meta_description_de text,
  ADD COLUMN IF NOT EXISTS meta_description_it text,
  ADD COLUMN IF NOT EXISTS meta_description_en text;

NOTIFY pgrst, 'reload schema';