
CREATE TABLE public.seo_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('seo_onpage','seo_technical','seo_local','geo','multilang','accessibility')),
  severity TEXT NOT NULL CHECK (severity IN ('good','warning','critical')),
  priority TEXT NOT NULL CHECK (priority IN ('P1','P2','P3')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_findings TO authenticated;
GRANT ALL ON public.seo_findings TO service_role;

ALTER TABLE public.seo_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read seo_findings"
  ON public.seo_findings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update seo_findings"
  ON public.seo_findings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert seo_findings"
  ON public.seo_findings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_seo_findings_updated_at
  BEFORE UPDATE ON public.seo_findings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.seo_findings (code, category, severity, priority, title, description, action) VALUES
('onpage_title_length','seo_onpage','warning','P2','Balises <title> trop longues','Certaines pages dépassent 60 caractères et sont tronquées dans les SERP Google.','Raccourcir les titres concernés à 50–60 caractères en conservant le mot-clé principal en premier.'),
('onpage_meta_description','seo_onpage','warning','P2','Meta descriptions manquantes ou faibles','Plusieurs pages thérapeutes héritent de la description par défaut au lieu d''une description unique.','Générer une meta description unique par profil thérapeute (140–160 caractères) à partir du bio.'),
('onpage_h1_unique','seo_onpage','critical','P1','H1 absent ou dupliqué','Certaines routes n''ont pas de balise <h1> explicite ou en ont plusieurs.','Garantir un seul <h1> sémantique par page, distinct du <title>.'),
('onpage_image_alt','seo_onpage','warning','P2','Attributs alt d''images manquants','Des photos de thérapeutes et illustrations de blog n''ont pas d''attribut alt descriptif.','Ajouter un alt décrivant l''image (ex. "Marie Dupont, sophrologue à Genève") sur toutes les <img>.'),
('onpage_internal_links','seo_onpage','good','P3','Maillage interne solide','La navigation interne entre thérapeutes, articles et événements est bien structurée.','Maintenir le maillage actuel et ajouter des liens contextuels depuis les nouveaux articles.'),
('tech_sitemap','seo_technical','good','P3','Sitemap dynamique opérationnel','/sitemap.xml liste pages statiques, thérapeutes actifs, événements et articles dans les 4 langues.','Vérifier mensuellement via Google Search Console que toutes les URLs sont découvertes.'),
('tech_robots','seo_technical','good','P3','robots.txt correctement configuré','Les bots IA (GPTBot, ClaudeBot, PerplexityBot) et Googlebot ont accès, l''admin est exclu.','Aucune action requise.'),
('tech_https','seo_technical','good','P3','HTTPS actif partout','Toutes les pages servies en HTTPS avec redirection HTTP→HTTPS.','Aucune action requise.'),
('tech_core_web_vitals','seo_technical','warning','P2','Core Web Vitals à surveiller','LCP et CLS proches des seuils sur certaines pages mobiles.','Lazy-loader les images sous la ligne de flottaison et précharger la police principale.'),
('tech_404','seo_technical','warning','P2','Page 404 personnalisée à enrichir','La 404 existe mais ne propose pas de liens utiles vers les sections clés.','Ajouter des suggestions (thérapeutes populaires, blog, recherche) sur la page 404.'),
('local_schema','seo_local','critical','P1','Schema.org LocalBusiness incomplet','Les fiches thérapeutes n''émettent pas de JSON-LD MedicalBusiness/LocalBusiness avec NAP.','Ajouter un JSON-LD LocalBusiness sur /therapeute/$slug avec name, address, telephone, geo, openingHours.'),
('local_nap','seo_local','warning','P2','Cohérence NAP à vérifier','Nom, adresse et téléphone affichés diffèrent parfois entre fiche, footer et Google Maps.','Centraliser le NAP dans le profil thérapeute et l''utiliser partout (footer, schema, Maps).'),
('geo_faq','geo','warning','P2','FAQ enrichies manquantes','Peu de pages exposent des Q/R structurées, ce qui limite la reprise par ChatGPT/Perplexity.','Ajouter une section FAQ + JSON-LD FAQPage sur /tarifs, /therapeutes et chaque page approche.'),
('geo_definitions','geo','warning','P2','Définitions peu explicites pour les IA','Les articles ne commencent pas toujours par une définition claire de la pratique.','Démarrer chaque article par un paragraphe "Qu''est-ce que X ? — définition en 2-3 phrases".'),
('geo_entities','geo','good','P3','Entités nommées claires','Les noms des approches, cantons et thérapeutes sont reconnaissables.','Continuer à utiliser des entités nommées explicites dans les nouveaux contenus.'),
('multi_hreflang','multilang','critical','P1','Balises hreflang FR/DE/IT/EN absentes','Aucune balise hreflang n''est émise, Google ne sait pas relier les versions linguistiques.','Ajouter <link rel="alternate" hreflang="fr|de|it|en|x-default"> dans le <head> de chaque route $lang.'),
('multi_canonical','multilang','warning','P2','URL canoniques par langue à vérifier','Certaines pages traduites peuvent pointer vers la version FR au lieu d''elles-mêmes.','S''assurer que <link rel="canonical"> pointe sur la version dans la langue courante.'),
('a11y_contrast','accessibility','warning','P2','Contrastes insuffisants sur certains placeholders','Les placeholders sur fond violet foncé sont sous le seuil WCAG AA dans certains états.','Augmenter l''opacité du texte placeholder à ≥ 60% sur fond sombre.'),
('a11y_aria_labels','accessibility','good','P3','aria-label présents sur les boutons icône','Les boutons icône (recherche, favori, menu) ont des aria-label explicites.','Maintenir cette discipline sur les nouveaux composants.')
ON CONFLICT (code) DO NOTHING;
