ALTER TABLE public.specialties
  ADD COLUMN IF NOT EXISTS categories text[] NOT NULL DEFAULT '{}'::text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'specialties_categories_valid'
  ) THEN
    ALTER TABLE public.specialties
      ADD CONSTRAINT specialties_categories_valid
      CHECK (categories <@ ARRAY['bien-etre','holistique']::text[]);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS specialties_categories_idx
  ON public.specialties USING GIN (categories);

-- Bien-être
UPDATE public.specialties SET categories = ARRAY['bien-etre']::text[]
WHERE slug IN ('massage-bien-etre','massotherapie','coaching-de-vie','naturopathie',
  'nutrition','micronutrition','osteopathie','acupuncture','medecine-chinoise',
  'ayurveda','breathwork','meditation','reflexologie','shiatsu','yoga','relaxation','sophrologie');

-- Holistique
UPDATE public.specialties SET categories = ARRAY['holistique']::text[]
WHERE slug IN ('magnetisme','radiesthesie','emdr','hypnose','fleurs-de-bach',
  'lithotherapie','art-therapie','lahochi','psychotherapie','accompagnement-psy',
  'reiki','sonotherapie','energetique','geobiologie');

-- Les deux univers
UPDATE public.specialties SET categories = ARRAY['bien-etre','holistique']::text[]
WHERE slug IN ('phytotherapie','aromatherapie');

-- Repli : toute spécialité active non classée rejoint le bien-être
UPDATE public.specialties SET categories = ARRAY['bien-etre']::text[]
WHERE categories = '{}'::text[];

-- Nouvelles approches holistiques
INSERT INTO public.specialties (slug, family_id, name_fr, name_de, name_it, name_en, categories, is_active, sort_order)
SELECT v.slug, f.id, v.name_fr, v.name_de, v.name_it, v.name_en, ARRAY['holistique']::text[], true, 100
FROM (VALUES
  ('guerison-spirituelle','corps-et-energie','Guérison spirituelle','Geistiges Heilen','Guarigione spirituale','Spiritual healing'),
  ('therapie-energetique','corps-et-energie','Thérapie énergétique','Energiearbeit','Terapia energetica','Energy therapy'),
  ('approche-chamanique','corps-et-energie','Approche thérapeutique chamanique','Schamanische Therapie','Approccio sciamanico','Shamanic therapy'),
  ('soulhealing','corps-et-energie','Soulhealing — guérison de l''âme','Soulhealing — Seelenheilung','Soulhealing — guarigione dell''anima','Soulhealing'),
  ('aurahealing','corps-et-energie','Aurahealing — soins de l''aura','Aurahealing — Aura-Arbeit','Aurahealing — cura dell''aura','Aura healing'),
  ('accompagnement-mediumnique','corps-et-energie','Accompagnement médiumnique','Mediale Begleitung','Accompagnamento medianico','Mediumship guidance'),
  ('wingwave','therapies-psychocorporelles','Wingwave','Wingwave','Wingwave','Wingwave'),
  ('eft','therapies-psychocorporelles','EFT — libération émotionnelle','EFT — Klopfakupressur','EFT — liberazione emotiva','EFT — emotional freedom technique'),
  ('accompagnement-trauma','therapies-psychocorporelles','Accompagnement sensible aux traumatismes','Traumasensible Begleitung','Accompagnamento sensibile al trauma','Trauma-informed support'),
  ('neurosense','therapies-psychocorporelles','Neurosense','Neurosense','Neurosense','Neurosense'),
  ('accompagnement-deuil','developpement-personnel','Accompagnement du deuil','Trauerbegleitung','Accompagnamento al lutto','Grief support'),
  ('accompagnement-fin-de-vie','developpement-personnel','Accompagnement en fin de vie','Sterbebegleitung','Accompagnamento di fine vita','End-of-life support'),
  ('psychophytologie','medecines-naturelles','Psychophytologie','Psychophytologie','Psicofitologia','Psychophytology')
) AS v(slug, family_slug, name_fr, name_de, name_it, name_en)
JOIN public.specialty_families f ON f.slug = v.family_slug
ON CONFLICT (slug) DO NOTHING;