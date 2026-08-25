-- ============================================================================
-- Blog — slugs allemands pour les articles traduits
--
-- PROBLÈME (audit du 25/08/2026)
--   41 des 48 articles publiés servent leur version allemande sous une URL
--   française : /de/blog/anxiete-generalisee-sophrologie-hypnose-eft-suisse
--   pour un texte intitulé « Generalisierte Angststörung Schweiz ». Le mécanisme
--   `slug_de` existe et fonctionne (7 articles l'utilisent déjà), il n'avait
--   simplement jamais été renseigné. C'est un frein direct sur la Suisse
--   alémanique, marché prioritaire pour le recrutement de praticiens.
--
-- CE QUE FAIT CETTE MIGRATION
--   Renseigne `slug_de` sur 32 articles dont le titre allemand est propre et
--   cohérent. Les slugs sont RÉDIGÉS, pas dérivés mécaniquement du titre : les 7
--   slugs existants suivent une convention éditoriale condensée
--   (« Akupunktur in Genf und Lausanne: Vollständiger Leitfaden… »
--    → `akupunktur-schweiz-leitfaden`) qu'une slugification automatique aurait
--   cassée, en figeant au passage des URL définitives et médiocres.
--   Transliteration allemande usuelle : ä→ae, ö→oe, ü→ue (comme
--   `aromatherapie-schweiz-aetherische-oele`).
--
--   ⚠️ Une URL est un engagement permanent : relire la liste avant d'appliquer.
--   La redirection de l'ancien slug vers le nouveau est déjà en place et passe
--   désormais en 301 (voir $lang.blog.$slug.tsx).
--
-- NON TRAITÉS — 9 articles écartés volontairement, défaut de contenu à corriger
--   d'abord dans /admin/articles (leur donner un slug allemand figerait le défaut) :
--     · yoga-therapeutique-suisse-sante-bien-etre        title_de encore en FRANÇAIS
--     · douleurs-chroniques-medecine-naturelle-suisse    title_de encore en FRANÇAIS
--     · remboursement-asca-rme-naturopathie-acupuncture-suisse   title_de VIDE
--     · lithotherapie-suisse-cristaux-bien-etre-energetique      title_de commence par « # »
--     · geobiologue-suisse-habitat-sain-bien-etre                title_de commence par « # »
--     · ayurveda-suisse-praticiens-therapeutes           corps de l'article fuité dans le titre
--     · arthrose-...-suisse                              titre mêlant allemand et « Suisse romande »
--     · sophrologie-suisse-gerer-stress                  faute : « Sophrolologie »
--     · therapeute-holistique-zurich-bale-berne-suisse-allemande
--         → title_de annonce « Westschweiz » alors que l'article porte sur la
--           Suisse ALÉMANIQUE : la traduction contredit son sujet.
--
-- Idempotente : n'écrit que si `slug_de` est vide, et refuse toute collision.
-- À appliquer via Lovable.
-- ============================================================================

with proposed(slug_fr, slug_de) as (
  values
  ('magnetiseur-suisse-soins-energetiques-magnetisme', 'magnetismus-schweiz-energetische-behandlungen'),
  ('anxiete-generalisee-sophrologie-hypnose-eft-suisse', 'angststoerung-schweiz-sophrologie-hypnose-eft'),
  ('lithotherapie-suisse-cristaux-bien-etre', 'lithotherapie-schweiz-kristalle-wohlbefinden'),
  ('intestin-irritable-naturopathie-phytotherapie-acupuncture-valais', 'phytotherapie-reizdarm-wallis'),
  ('eft-tapping-suisse-liberation-emotionnelle', 'eft-tapping-schweiz-emotionale-befreiung'),
  ('burn-out-5-therapies-alternatives-efficaces', 'burnout-schweiz-fuenf-wirksame-therapien'),
  ('insomnie-chronique-suisse-naturopathie-hypnose-yoga-therapeutique', 'yogatherapie-schlaflosigkeit-naturheilkunde-hypnose'),
  ('meditation-guidee-debutants-suisse', 'gefuehrte-meditation-schweiz-anfaenger'),
  ('prevention-blessures-sportives-suisse-osteopathie-kinesiologie', 'kinesiologie-osteopathie-schweiz-sportverletzungen'),
  ('reiki-distance-suisse-praticiens-certifies', 'fern-reiki-schweiz-zertifizierte-praktizierende'),
  ('insomnie-troubles-sommeil-therapie-holistique-suisse', 'achtsamkeitsmeditation-schlaflosigkeit-schweiz'),
  ('massage-bien-etre-suisse', 'wellness-massage-schweiz-arten-vorteile'),
  ('bienfaits-reiki-guide-complet', 'reiki-vorteile-leitfaden-anfaenger'),
  ('naturopathe-suisse-romande-guide-naturopathie', 'naturheilpraktiker-westschweiz-leitfaden'),
  ('stress-travail-burnout-naturopathie-coaching-holistique-suisse-romande', 'burnout-schweiz-naturheilkunde-coaching'),
  ('reflexologie-faciale-plantaire-suisse-differences-bienfaits', 'gesichts-fussreflexzonenmassage-schweiz-leitfaden'),
  ('kinesiologue-suisse-seance-bienfaits-reeequilibrage', 'kinesiologie-schweiz-begleitung-wohlbefinden'),
  ('coach-holistique-suisse-romande', 'holistisches-coaching-westschweiz'),
  ('shiatsu-massage-japonais-suisse', 'shiatsu-schweiz-japanische-massage'),
  ('reflexologie-plantaire-suisse-guide-bienfaits', 'fussreflexzonenmassage-schweiz-leitfaden'),
  ('osteopathie-holistique-suisse-differences-kine-chiro', 'holistische-osteopathie-schweiz-physio-chiro'),
  ('migraine-traitement-naturel-suisse-acupuncture-osteopathie', 'akupunktur-osteopathie-schweiz-migraene'),
  ('chromotherapie-suisse-guide-complet-luminotherapie', 'chromotherapie-schweiz-lichttherapie-leitfaden'),
  ('magnetisme-chakras-equilibre-energetique-vitalite-suisse', 'magnetismus-chakren-schweiz-energetisches-gleichgewicht'),
  ('menopause-bouffees-chaleur-acupuncture-phytotherapie-suisse', 'akupunktur-menopause-schweiz'),
  ('chromotherapie-luminotherapie-suisse', 'chromotherapie-schweiz-wohlbefinden'),
  ('fibromyalgie-acupuncture-osteopathie-massage-suisse-romande', 'fibromyalgie-westschweiz-akupunktur-osteopathie-massage'),
  ('tdah-enfant-therapie-naturelle-suisse-remboursement', 'adhs-kinder-schweiz-ganzheitliches-coaching'),
  ('endometriose-acupuncture-naturopathie-suisse', 'akupunktur-endometriose-schweiz'),
  ('eczema-atopique-traitement-naturel-suisse-aromatherapie-phytotherapie', 'aromatherapie-atopisches-ekzem-schweiz'),
  ('sciatique-hernie-discale-osteopathie-suisse-romande-geneve-lausanne', 'osteopathie-ischias-bandscheibenvorfall-westschweiz'),
  ('ayurveda-dosha-saisons-suisse-alemanique', 'ayurveda-doshas-jahreszeiten-schweiz')
)
update public.articles a
   set slug_de = p.slug_de,
       updated_at = now()
  from proposed p
 where a.slug = p.slug_fr
   and (a.slug_de is null or length(trim(a.slug_de)) = 0)
   -- garde-fou : jamais deux articles sous la même adresse allemande
   and not exists (
     select 1 from public.articles x
      where x.slug_de = p.slug_de and x.id <> a.id
   )
   and not exists (
     select 1 from public.articles y
      where y.slug = p.slug_de and y.id <> a.id
   );
