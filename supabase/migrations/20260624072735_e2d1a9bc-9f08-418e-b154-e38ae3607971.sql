
-- 1) app_settings table (admin-only key/value)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read app_settings" ON public.app_settings;
CREATE POLICY "Admins read app_settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins write app_settings" ON public.app_settings;
CREATE POLICY "Admins write app_settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Default: agent enabled
INSERT INTO public.app_settings(key, value)
VALUES ('seo_article_agent_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Insert the 3 pending articles from the external agent report
INSERT INTO public.articles (
  slug, status, lang, category,
  title_fr, excerpt_fr, body_fr,
  meta_title_fr, meta_description_fr
) VALUES
(
  'sophrologie-suisse-gerer-stress-pending',
  'pending_validation', 'fr', 'sophrologie',
  'Sophrologie Suisse : Gérer le Stress Efficacement',
  'La sophrologie est une technique holistique pour gérer le stress en Suisse. Respirations, relaxation musculaire et visualisation : découvrez comment retrouver l''équilibre physique et mental face aux défis quotidiens.',
  E'## Introduction\n\nLa sophrologie suisse stress est une technique de relaxation scientifiquement reconnue qui gère efficacement l''anxiété et les tensions du quotidien par la respiration, la relaxation musculaire et la visualisation mentale. En Suisse romande, 72% des utilisateurs rapportent une réduction significative de leurs symptômes d''anxiété après huit semaines de pratique régulière, selon une étude 2022 de l''Université de Lausanne.\n\nCette approche holistique combine des mécanismes physiologiques concrets : elle réduit le cortisol de 20-30% après quelques séances et améliore le bien-être mental sans effets secondaires. Si vous traversez une période stressante ou cherchez une méthode naturelle pour retrouver l''équilibre face aux défis professionnels et personnels, la gestion du stress sophrologie offre une réponse accessible et validée par la recherche.\n\n## Qu''est-ce que la sophrologie ?\n\nLa sophrologie est une discipline créée en 1960 par le neuropsychiatre Alfonso Caycedo, combinant le yoga, l''hypnose, la relaxation progressive et la méditation pour développer la conscience corporelle et mentale.\n\n> ⚠️ Article généré par l''agent externe — contenu à compléter avant publication.',
  'Sophrologie Suisse : Gérer le Stress Efficacement',
  'Découvrez comment la sophrologie suisse aide à gérer le stress au quotidien. Techniques naturelles de relaxation pour votre bien-être mental et physique.'
),
(
  'acupuncture-geneve-lausanne-comment-marche-pending',
  'pending_validation', 'fr', 'acupuncture',
  'Acupuncture à Genève et Lausanne : comment ça marche',
  'L''acupuncture, pratique millénaire chinoise, gagne en popularité à Genève et Lausanne. Cette thérapie stimule des points nerveux précis pour rétablir l''équilibre énergétique et déclencher des réactions physiologiques bénéfiques durables.',
  E'## Acupuncture : comment ça marche\n\nL''acupuncture à Genève et Lausanne est une pratique thérapeutique millénaire qui utilise l''insertion de fines aiguilles stériles en des points précis du corps pour rétablir l''équilibre énergétique selon la médecine traditionnelle chinoise. En Suisse romande, cette approche gagne en reconnaissance auprès des patients en quête de solutions naturelles et durables, avec environ 15% des habitants ayant essayé l''acupuncture au moins une fois.\n\nDe plus en plus de cabinets généralistes et de cliniques dans les grandes villes — de Genève à Lausanne — intègrent l''acupuncture à leur offre thérapeutique. Cette approche complémentaire ne remplace pas la médecine conventionnelle, mais s''y ajoute harmonieusement pour soulager la douleur, réduire le stress et améliorer la qualité de vie globale.\n\n> ⚠️ Article généré par l''agent externe — contenu à compléter avant publication.',
  'Acupuncture à Genève et Lausanne : comment ça marche',
  'Découvrez comment fonctionne l''acupuncture en Suisse romande. Médecine traditionnelle chinoise pour rétablir l''équilibre énergétique. Consultez un praticien.'
),
(
  'meditation-guidee-debutants-suisse-pending',
  'pending_validation', 'fr', 'meditation',
  'Méditation Guidée pour Débutants en Suisse | Guide Complet',
  'Explorez la méditation guidée, la méthode idéale pour débuter en Suisse romande. Avec un instructeur vocal, relaxez-vous sans anxiété et accédez à la sérénité en quelques séances.',
  E'## Méditation guidée pour débutants : Votre premier pas vers la sérénité\n\nLa méditation guidée suisse est la méthode la plus accessible pour débuter une pratique de méditation en Suisse romande, car une voix d''instructeur vous accompagne à chaque étape sans vous laisser seul face à vos pensées. Contrairement à la méditation silencieuse, où vous naviguez seul dans vos pensées, une méditation guidée pour débutants s''appuie sur la voix d''un instructeur qui vous guide.\n\nEn Suisse, la demande pour la méditation guidée a considérablement augmenté ces dernières années, avec 45% des Romands intéressés par des pratiques de bien-être selon une étude 2023.\n\n> ⚠️ Article généré par l''agent externe — contenu à compléter avant publication.',
  'Méditation Guidée pour Débutants en Suisse | Guide Complet',
  'Découvrez la méditation guidée adaptée aux débutants en Suisse. Apprenez à méditer sereinement avec un instructeur vocal. Commencez dès aujourd''hui !'
)
ON CONFLICT (slug) DO NOTHING;
