alter table public.specialty_families
  add column if not exists description_de text,
  add column if not exists description_it text,
  add column if not exists description_en text;