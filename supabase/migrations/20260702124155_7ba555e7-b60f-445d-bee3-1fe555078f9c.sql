
-- Extensions
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- 1) Tables
CREATE TABLE public.specialty_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  name_de text,
  name_it text,
  name_en text,
  description_fr text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.specialty_families TO anon, authenticated;
GRANT ALL ON public.specialty_families TO service_role;
ALTER TABLE public.specialty_families ENABLE ROW LEVEL SECURITY;
CREATE POLICY "families_read_public" ON public.specialty_families FOR SELECT USING (true);
CREATE POLICY "families_admin_write" ON public.specialty_families FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.specialties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES public.specialty_families(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  name_de text,
  name_it text,
  name_en text,
  description_fr text,
  aliases text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX specialties_family_idx ON public.specialties(family_id);
CREATE INDEX specialties_active_idx ON public.specialties(is_active);

GRANT SELECT ON public.specialties TO anon, authenticated;
GRANT ALL ON public.specialties TO service_role;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "specialties_read_public" ON public.specialties FOR SELECT USING (true);
CREATE POLICY "specialties_admin_write" ON public.specialties FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.therapist_specialties (
  therapist_id uuid NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
  specialty_id uuid NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (therapist_id, specialty_id)
);
CREATE INDEX therapist_specialties_specialty_idx ON public.therapist_specialties(specialty_id);

GRANT SELECT ON public.therapist_specialties TO anon, authenticated;
GRANT INSERT, DELETE ON public.therapist_specialties TO authenticated;
GRANT ALL ON public.therapist_specialties TO service_role;
ALTER TABLE public.therapist_specialties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "th_spec_read_public" ON public.therapist_specialties FOR SELECT USING (true);
CREATE POLICY "th_spec_owner_write" ON public.therapist_specialties FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.therapists t WHERE t.id = therapist_id AND t.user_id = auth.uid())
  );

CREATE TABLE public.specialty_import_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_label text NOT NULL,
  therapist_id uuid REFERENCES public.therapists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.specialty_import_pending TO service_role;
GRANT SELECT ON public.specialty_import_pending TO authenticated;
ALTER TABLE public.specialty_import_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_pending_admin" ON public.specialty_import_pending FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- triggers updated_at
CREATE TRIGGER trg_families_updated BEFORE UPDATE ON public.specialty_families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_specialties_updated BEFORE UPDATE ON public.specialties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Fonctions de recherche
CREATE OR REPLACE FUNCTION public.normalize_search(_input text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT lower(extensions.unaccent(coalesce(_input,'')));
$$;

CREATE OR REPLACE FUNCTION public.search_specialties(_q text, _limit int DEFAULT 10)
RETURNS TABLE(id uuid, slug text, name_fr text, family_slug text, family_name_fr text, rank int)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (SELECT public.normalize_search(_q) AS n)
  SELECT s.id, s.slug, s.name_fr, f.slug, f.name_fr,
    CASE
      WHEN public.normalize_search(s.name_fr) = q.n THEN 100
      WHEN public.normalize_search(s.name_fr) LIKE q.n || '%' THEN 80
      WHEN EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) = q.n) THEN 70
      WHEN public.normalize_search(s.name_fr) LIKE '%' || q.n || '%' THEN 50
      WHEN EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) LIKE '%' || q.n || '%') THEN 40
      ELSE 0
    END AS rank
  FROM public.specialties s
  JOIN public.specialty_families f ON f.id = s.family_id
  , q
  WHERE s.is_active
    AND length(q.n) >= 2
    AND (
      public.normalize_search(s.name_fr) LIKE '%' || q.n || '%'
      OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) LIKE '%' || q.n || '%')
    )
  ORDER BY rank DESC, length(s.name_fr) ASC
  LIMIT _limit;
$$;

-- 3) Seed familles + spécialités
INSERT INTO public.specialty_families (slug, name_fr, name_de, name_it, name_en, description_fr, icon, sort_order) VALUES
('therapies-psychocorporelles', 'Thérapies psychocorporelles', 'Psychokörperliche Therapien', 'Terapie psicocorporee', 'Mind-body therapies',
 'Approches qui relient l''esprit et le corps pour libérer les blocages émotionnels et retrouver un mieux-être durable.', 'brain', 1),
('medecines-naturelles', 'Médecines naturelles', 'Naturheilkunde', 'Medicine naturali', 'Natural medicine',
 'Soins fondés sur les ressources de la nature : plantes, alimentation, oligo-éléments, pour soutenir la vitalité.', 'leaf', 2),
('corps-et-energie', 'Corps et énergie', 'Körper und Energie', 'Corpo ed energia', 'Body & energy',
 'Techniques manuelles et énergétiques qui rétablissent la circulation vitale et apaisent les tensions.', 'hand', 3),
('developpement-personnel', 'Développement personnel & expression', 'Persönliche Entwicklung', 'Sviluppo personale', 'Personal growth',
 'Pratiques d''ancrage, de créativité et de conscience de soi pour cultiver équilibre et sens.', 'sparkles', 4);

WITH f AS (SELECT slug, id FROM public.specialty_families)
INSERT INTO public.specialties (family_id, slug, name_fr, aliases, is_featured, sort_order) VALUES
-- Famille 1
((SELECT id FROM f WHERE slug='therapies-psychocorporelles'), 'sophrologie', 'Sophrologie', ARRAY['sophro','sophrologue'], true, 1),
((SELECT id FROM f WHERE slug='therapies-psychocorporelles'), 'hypnose', 'Hypnose', ARRAY['hypnotherapie','hypnotherapeute','hypnotiseur'], true, 2),
((SELECT id FROM f WHERE slug='therapies-psychocorporelles'), 'emdr', 'EMDR', ARRAY['desensibilisation'], true, 3),
((SELECT id FROM f WHERE slug='therapies-psychocorporelles'), 'psychotherapie', 'Psychothérapie', ARRAY['psy','psychotherapeute','psycho','therapeute'], true, 4),
((SELECT id FROM f WHERE slug='therapies-psychocorporelles'), 'accompagnement-psy', 'Accompagnement psy', ARRAY['soutien psychologique','coaching psy'], false, 5),
((SELECT id FROM f WHERE slug='therapies-psychocorporelles'), 'relaxation', 'Relaxation', ARRAY['detente','relaxologie'], false, 6),
-- Famille 2
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'naturopathie', 'Naturopathie', ARRAY['naturopathe','natur'], true, 1),
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'phytotherapie', 'Phytothérapie', ARRAY['phyto','plantes medicinales'], false, 2),
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'aromatherapie', 'Aromathérapie', ARRAY['aroma','huiles essentielles'], false, 3),
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'fleurs-de-bach', 'Fleurs de Bach', ARRAY['bach','elixirs floraux'], false, 4),
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'nutrition', 'Nutrition', ARRAY['nutritionniste','alimentation','reequilibrage alimentaire'], true, 5),
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'micronutrition', 'Micronutrition', ARRAY['nutrition fonctionnelle','nutritherapie'], false, 6),
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'ayurveda', 'Ayurveda', ARRAY['ayurvedique','medecine ayurvedique'], false, 7),
((SELECT id FROM f WHERE slug='medecines-naturelles'), 'medecine-chinoise', 'Médecine chinoise', ARRAY['mtc','medecine traditionnelle chinoise'], false, 8),
-- Famille 3
((SELECT id FROM f WHERE slug='corps-et-energie'), 'reflexologie', 'Réflexologie', ARRAY['reflexo','reflexologie plantaire','reflexologue'], true, 1),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'shiatsu', 'Shiatsu', ARRAY['shiatsu therapeute'], false, 2),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'acupuncture', 'Acupuncture', ARRAY['acupuncteur','acuponcture'], true, 3),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'osteopathie', 'Ostéopathie', ARRAY['osteo','osteopathe'], true, 4),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'massage-bien-etre', 'Massage bien-être', ARRAY['massage','masseur','masseuse','massage relaxant'], true, 5),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'reiki', 'Reiki', ARRAY['praticien reiki','maitre reiki'], false, 6),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'magnetisme', 'Magnétisme', ARRAY['magnetiseur','energeticien'], false, 7),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'massotherapie', 'Massothérapie', ARRAY['masso','massage therapeutique'], false, 8),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'lithotherapie', 'Lithothérapie', ARRAY['litho','lithotherapeute','pierres','mineraux'], false, 9),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'radiesthesie', 'Radiesthésie', ARRAY['radiesthesiste','pendule'], false, 10),
((SELECT id FROM f WHERE slug='corps-et-energie'), 'lahochi', 'LaHoChi', ARRAY['la ho chi','lahochi therapeute'], false, 11),
-- Famille 4
((SELECT id FROM f WHERE slug='developpement-personnel'), 'coaching-de-vie', 'Coaching de vie', ARRAY['coach','coaching','life coach'], true, 1),
((SELECT id FROM f WHERE slug='developpement-personnel'), 'meditation', 'Méditation', ARRAY['pleine conscience','mindfulness'], true, 2),
((SELECT id FROM f WHERE slug='developpement-personnel'), 'yoga', 'Yoga', ARRAY['hatha','vinyasa','yin yoga'], true, 3),
((SELECT id FROM f WHERE slug='developpement-personnel'), 'art-therapie', 'Art-thérapie', ARRAY['art therapeute','therapie par l art'], false, 4),
((SELECT id FROM f WHERE slug='developpement-personnel'), 'breathwork', 'Breathwork', ARRAY['respiration consciente','travail du souffle'], false, 5),
((SELECT id FROM f WHERE slug='developpement-personnel'), 'sonotherapie', 'Sonothérapie', ARRAY['bols tibetains','therapie sonore','bain sonore'], false, 6);

-- 4) Backfill : mapper l'ancien text[] specialties vers la pivot
DO $$
DECLARE
  r record;
  raw_label text;
  norm text;
  matched_id uuid;
BEGIN
  FOR r IN SELECT id, specialties FROM public.therapists WHERE specialties IS NOT NULL AND array_length(specialties,1) > 0 LOOP
    FOREACH raw_label IN ARRAY r.specialties LOOP
      norm := public.normalize_search(raw_label);
      IF length(norm) < 2 THEN CONTINUE; END IF;
      SELECT s.id INTO matched_id
      FROM public.specialties s
      WHERE public.normalize_search(s.name_fr) = norm
         OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) = norm)
         OR public.normalize_search(s.name_fr) LIKE '%' || norm || '%'
         OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE public.normalize_search(a) LIKE '%' || norm || '%')
      ORDER BY (public.normalize_search(s.name_fr) = norm) DESC,
               length(s.name_fr) ASC
      LIMIT 1;

      IF matched_id IS NOT NULL THEN
        INSERT INTO public.therapist_specialties (therapist_id, specialty_id)
        VALUES (r.id, matched_id) ON CONFLICT DO NOTHING;
      ELSE
        INSERT INTO public.specialty_import_pending (raw_label, therapist_id)
        VALUES (raw_label, r.id);
      END IF;
    END LOOP;
  END LOOP;
END $$;
