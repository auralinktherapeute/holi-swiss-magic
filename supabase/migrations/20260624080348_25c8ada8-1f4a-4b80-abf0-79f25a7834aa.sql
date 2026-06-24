
-- 1. Table article_categories
CREATE TABLE IF NOT EXISTS public.article_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name_fr text NOT NULL,
  name_de text NOT NULL DEFAULT '',
  name_it text NOT NULL DEFAULT '',
  name_en text NOT NULL DEFAULT '',
  parent_category text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.article_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_categories TO authenticated;
GRANT ALL ON public.article_categories TO service_role;

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read article categories" ON public.article_categories;
CREATE POLICY "Public read article categories" ON public.article_categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage article categories" ON public.article_categories;
CREATE POLICY "Admins manage article categories" ON public.article_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_article_categories_updated_at ON public.article_categories;
CREATE TRIGGER update_article_categories_updated_at BEFORE UPDATE ON public.article_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Secondary tags column on articles
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS secondary_tags text[] NOT NULL DEFAULT '{}';

-- 3. Seed categories
INSERT INTO public.article_categories (slug, name_fr, name_de, name_it, name_en, parent_category, sort_order) VALUES
-- Approches corporelles
('massage-bien-etre','Massage bien-être','Wellness-Massage','Massaggio benessere','Wellness massage','corporelles',10),
('osteopathie','Ostéopathie','Osteopathie','Osteopatia','Osteopathy','corporelles',20),
('kinesitherapie','Kinésithérapie','Physiotherapie','Fisioterapia','Physiotherapy','corporelles',30),
('chiropraxie','Chiropraxie','Chiropraktik','Chiropratica','Chiropractic','corporelles',40),
('reflexologie','Réflexologie','Reflexologie','Riflessologia','Reflexology','corporelles',50),
('shiatsu','Shiatsu','Shiatsu','Shiatsu','Shiatsu','corporelles',60),
('tuina','Tuina','Tuina','Tuina','Tuina','corporelles',70),
('yoga','Yoga','Yoga','Yoga','Yoga','corporelles',80),
('pilates','Pilates','Pilates','Pilates','Pilates','corporelles',90),
('tai-chi-qi-gong','Tai Chi / Qi Gong','Tai Chi / Qi Gong','Tai Chi / Qi Gong','Tai Chi / Qi Gong','corporelles',100),
-- Énergétiques
('reiki','Reiki','Reiki','Reiki','Reiki','energetiques',10),
('magnetisme','Magnétisme','Magnetismus','Magnetismo','Magnetism','energetiques',20),
('acupuncture','Acupuncture','Akupunktur','Agopuntura','Acupuncture','energetiques',30),
('lithotherapie','Lithothérapie','Lithotherapie','Litoterapia','Lithotherapy','energetiques',40),
('cristallotherapie','Cristallothérapie','Kristalltherapie','Cristalloterapia','Crystal therapy','energetiques',50),
('sonotherapie','Sonothérapie','Klangtherapie','Sonoterapia','Sound therapy','energetiques',60),
('access-bars','Access Bars','Access Bars','Access Bars','Access Bars','energetiques',70),
('theta-healing','Theta Healing','Theta Healing','Theta Healing','Theta Healing','energetiques',80),
-- Psycho-émotionnelles
('hypnose','Hypnose','Hypnose','Ipnosi','Hypnosis','psycho',10),
('sophrologie','Sophrologie','Sophrologie','Sofrologia','Sophrology','psycho',20),
('coaching','Coaching','Coaching','Coaching','Coaching','psycho',30),
('pnl','PNL','NLP','PNL','NLP','psycho',40),
('emdr','EMDR','EMDR','EMDR','EMDR','psycho',50),
('tcc','TCC','KVT','TCC','CBT','psycho',60),
('psychotherapie','Psychothérapie','Psychotherapie','Psicoterapia','Psychotherapy','psycho',70),
('art-therapie','Art-thérapie','Kunsttherapie','Arteterapia','Art therapy','psycho',80),
-- Médecines naturelles
('naturopathie','Naturopathie','Naturheilkunde','Naturopatia','Naturopathy','naturelles',10),
('aromatherapie','Aromathérapie','Aromatherapie','Aromaterapia','Aromatherapy','naturelles',20),
('homeopathie','Homéopathie','Homöopathie','Omeopatia','Homeopathy','naturelles',30),
('phytotherapie','Phytothérapie','Phytotherapie','Fitoterapia','Phytotherapy','naturelles',40),
('ayurveda','Ayurveda','Ayurveda','Ayurveda','Ayurveda','naturelles',50),
('medecine-traditionnelle-chinoise','Médecine Traditionnelle Chinoise','Traditionelle Chinesische Medizin','Medicina Tradizionale Cinese','Traditional Chinese Medicine','naturelles',60),
-- Bien-être général
('meditation','Méditation','Meditation','Meditazione','Meditation','bien-etre',10),
('mindfulness','Mindfulness','Achtsamkeit','Mindfulness','Mindfulness','bien-etre',20),
('nutrition-sante','Nutrition & Santé','Ernährung & Gesundheit','Nutrizione & Salute','Nutrition & Health','bien-etre',30),
('bien-etre','Bien-être général','Allgemeines Wohlbefinden','Benessere generale','General well-being','bien-etre',40),
('developpement-personnel','Développement personnel','Persönliche Entwicklung','Sviluppo personale','Personal development','bien-etre',50),
('spiritualite','Spiritualité','Spiritualität','Spiritualità','Spirituality','bien-etre',60)
ON CONFLICT (slug) DO UPDATE SET
  name_fr = EXCLUDED.name_fr, name_de = EXCLUDED.name_de, name_it = EXCLUDED.name_it, name_en = EXCLUDED.name_en,
  parent_category = EXCLUDED.parent_category, sort_order = EXCLUDED.sort_order, updated_at = now();

-- 4. Fix existing wrong category assignments
UPDATE public.articles SET category = 'massage-bien-etre' WHERE slug = 'massage-bien-etre-suisse';
UPDATE public.articles SET category = 'naturopathie' WHERE slug IN ('naturopathie-suisse-romande-guide-naturopathes');
UPDATE public.articles SET category = 'sophrologie' WHERE slug = 'sophrologie-suisse-gerer-stress';
UPDATE public.articles SET category = 'acupuncture' WHERE slug = 'acupuncture-geneve-lausanne-comment-ca-marche';
UPDATE public.articles SET category = 'kinesitherapie' WHERE category = 'kine';
UPDATE public.articles SET category = 'psychotherapie' WHERE category = 'mental';
UPDATE public.articles SET category = 'bien-etre' WHERE category IN ('chronique','remboursements');
-- Older free-text labels
UPDATE public.articles SET category = 'naturopathie' WHERE category = 'Pratiques holistiques';
UPDATE public.articles SET category = 'sophrologie' WHERE category = 'Bien-être mental';
UPDATE public.articles SET category = 'medecine-traditionnelle-chinoise' WHERE category = 'Médecine traditionnelle';
