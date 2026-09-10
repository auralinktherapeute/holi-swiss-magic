
-- Enrichissement non destructif du catalogue de spécialités.
-- Familles existantes réutilisées ; aucun DROP, aucun DELETE.

DO $$
DECLARE
  f_psycho uuid;
  f_nat    uuid;
  f_energy uuid;
  f_dev    uuid;
  base     int;
BEGIN
  SELECT id INTO f_psycho FROM public.specialty_families WHERE slug = 'therapies-psychocorporelles';
  SELECT id INTO f_nat    FROM public.specialty_families WHERE slug = 'medecines-naturelles';
  SELECT id INTO f_energy FROM public.specialty_families WHERE slug = 'corps-et-energie';
  SELECT id INTO f_dev    FROM public.specialty_families WHERE slug = 'developpement-personnel';
  SELECT COALESCE(MAX(sort_order), 0) INTO base FROM public.specialties;

  INSERT INTO public.specialties (family_id, slug, name_fr, aliases, categories, sort_order)
  VALUES
    -- Bien-être
    (f_energy, 'kinesiologie',            'Kinésiologie',                    ARRAY['kinesiologie'],                      ARRAY['bien-etre'], base + 1),
    (f_energy, 'drainage-lymphatique',    'Drainage lymphatique',            ARRAY['drainage','lymphatique'],            ARRAY['bien-etre'], base + 2),
    (f_energy, 'fasciatherapie',          'Fasciathérapie',                  ARRAY['fascia','fasciatherapie'],           ARRAY['bien-etre'], base + 3),
    (f_energy, 'osteopathie-cranienne',   'Ostéopathie crânienne',           ARRAY['cranio-sacre','osteopathie cranienne'], ARRAY['bien-etre'], base + 4),
    (f_energy, 'chiropraxie',             'Chiropraxie',                     ARRAY['chiropractie','chiropracteur'],      ARRAY['bien-etre'], base + 5),
    (f_energy, 'do-in',                   'Do-in',                           ARRAY['doin','automassage'],                ARRAY['bien-etre'], base + 6),
    (f_dev,    'qi-gong',                 'Qi Gong',                         ARRAY['qigong','chi gong'],                 ARRAY['bien-etre'], base + 7),
    (f_dev,    'tai-chi',                 'Tai-chi',                         ARRAY['taichi','tai chi chuan'],            ARRAY['bien-etre'], base + 8),
    (f_dev,    'pilates-therapeutique',   'Pilates thérapeutique',           ARRAY['pilates'],                           ARRAY['bien-etre'], base + 9),
    (f_nat,    'hydrotherapie',           'Hydrothérapie',                   ARRAY['hydrotherapie'],                     ARRAY['bien-etre'], base + 10),
    (f_nat,    'thalassotherapie',        'Thalassothérapie',                ARRAY['thalasso'],                          ARRAY['bien-etre'], base + 11),
    (f_nat,    'balneotherapie',          'Balnéothérapie',                  ARRAY['balneo'],                            ARRAY['bien-etre'], base + 12),
    (f_dev,    'gestion-du-stress',       'Gestion du stress',               ARRAY['stress','burnout'],                  ARRAY['bien-etre'], base + 13),
    (f_dev,    'coherence-cardiaque',     'Cohérence cardiaque',             ARRAY['coherence cardiaque','respiration'], ARRAY['bien-etre'], base + 14),
    (f_energy, 'massage-ayurvedique',     'Massage ayurvédique',             ARRAY['abhyanga','massage ayurveda'],       ARRAY['bien-etre'], base + 15),
    (f_energy, 'massage-suedois',         'Massage suédois',                 ARRAY['massage suedois'],                   ARRAY['bien-etre'], base + 16),
    (f_energy, 'massage-sportif',         'Massage sportif',                 ARRAY['massage sport'],                     ARRAY['bien-etre'], base + 17),
    (f_energy, 'reflexologie-faciale',    'Réflexologie faciale (Dien Chan)', ARRAY['dien chan','reflexologie faciale'], ARRAY['bien-etre'], base + 18),
    -- Holistique
    (f_energy, 'access-bars',             'Access Bars',                     ARRAY['access consciousness','bars'],       ARRAY['holistique'], base + 19),
    (f_psycho, 'constellations-familiales','Constellations familiales',      ARRAY['constellation familiale','hellinger'], ARRAY['holistique'], base + 20),
    (f_energy, 'channeling',              'Channeling',                      ARRAY['canalisation'],                      ARRAY['holistique'], base + 21),
    (f_psycho, 'decodage-biologique',     'Décodage biologique',             ARRAY['biodecodage','decodage'],            ARRAY['holistique','bien-etre'], base + 22),
    (f_psycho, 'psychogenealogie',        'Psychogénéalogie',                ARRAY['transgenerationnel'],                ARRAY['holistique'], base + 23),
    (f_dev,    'numerologie',             'Numérologie',                     ARRAY['numerologie'],                       ARRAY['holistique'], base + 24),
    (f_dev,    'astrologie-therapeutique','Astrologie thérapeutique',        ARRAY['astrologie'],                        ARRAY['holistique'], base + 25),
    (f_dev,    'tarot-therapeutique',     'Tarot thérapeutique',             ARRAY['tarot','guidance'],                  ARRAY['holistique'], base + 26),
    (f_dev,    'feng-shui-therapeutique', 'Feng Shui thérapeutique',         ARRAY['feng shui','geobiologie'],           ARRAY['holistique'], base + 27),
    (f_psycho, 'rebirth',                 'Rebirth',                         ARRAY['rebirthing','respiration consciente'], ARRAY['holistique'], base + 28),
    (f_energy, 'theta-healing',           'Théta Healing',                   ARRAY['thetahealing','theta'],              ARRAY['holistique'], base + 29),
    (f_energy, 'communication-animale',   'Communication animale',           ARRAY['communication animale','animaux'],   ARRAY['holistique'], base + 30)
  ON CONFLICT (slug) DO NOTHING;
END $$;

-- Double catégorie pour les spécialités qui relèvent des deux univers.
UPDATE public.specialties
   SET categories = ARRAY['bien-etre','holistique'], updated_at = now()
 WHERE slug IN ('sophrologie','yoga','meditation','naturopathie','sonotherapie','decodage-biologique')
   AND NOT (categories @> ARRAY['bien-etre'] AND categories @> ARRAY['holistique']);

-- Synonymes de recherche pour éviter des doublons de spécialités déjà présentes.
UPDATE public.specialties SET aliases = (SELECT ARRAY(SELECT DISTINCT unnest(aliases || ARRAY['reflexologie plantaire','reflexologie podale']))), updated_at = now() WHERE slug = 'reflexologie';
UPDATE public.specialties SET aliases = (SELECT ARRAY(SELECT DISTINCT unnest(aliases || ARRAY['soins energetiques','soin energetique']))), updated_at = now() WHERE slug = 'therapie-energetique';
UPDATE public.specialties SET aliases = (SELECT ARRAY(SELECT DISTINCT unnest(aliases || ARRAY['soins chamaniques','chamanisme']))), updated_at = now() WHERE slug = 'approche-chamanique';
UPDATE public.specialties SET aliases = (SELECT ARRAY(SELECT DISTINCT unnest(aliases || ARRAY['cristallotherapie','pierres','cristaux']))), updated_at = now() WHERE slug = 'lithotherapie';
UPDATE public.specialties SET aliases = (SELECT ARRAY(SELECT DISTINCT unnest(aliases || ARRAY['bols tibetains','sonotherapie','sound healing']))), updated_at = now() WHERE slug = 'sonotherapie';
