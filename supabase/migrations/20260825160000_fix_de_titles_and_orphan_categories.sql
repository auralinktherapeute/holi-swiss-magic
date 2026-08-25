-- ============================================================================
-- Blog — titres allemands défectueux et catégories orphelines
--
-- Deux corrections de données issues de l'audit du 25/08/2026.
--
-- CHAQUE UPDATE EST GARDÉ PAR LA VALEUR ACTUELLE (`and title_de = '…'`).
-- Si quelqu'un a corrigé l'article entre-temps, la ligne est simplement
-- ignorée : la migration ne peut pas écraser un travail plus récent. C'est
-- aussi ce qui la rend idempotente.
-- ============================================================================

-- ── 1. Titres allemands ─────────────────────────────────────────────────────
-- Neuf articles publiés dont le champ `title_de` est inexploitable. Le détail
-- de chaque cas est en commentaire : rien n'est corrigé « en gros ».

-- (a) Titre resté en FRANÇAIS — traduit.
update public.articles set title_de = 'Yogatherapie in der Schweiz: Wohlbefinden und Vitalität', updated_at = now()
 where slug = 'yoga-therapeutique-suisse-sante-bien-etre'
   and title_de = 'Yoga thérapeutique en Suisse : Santé globale et bien-être';

update public.articles set title_de = 'Chronische Schmerzen: natürliche Ansätze in der Schweiz', updated_at = now()
 where slug = 'douleurs-chroniques-medecine-naturelle-suisse'
   and title_de = 'Douleurs chroniques : approches naturelles en Suisse';

-- (b) Titre VIDE — traduit depuis le français
--     (« Naturopathie ASCA RME : remboursement assurance 2024 »).
update public.articles set title_de = 'Naturheilkunde ASCA und RME: Rückerstattung durch die Zusatzversicherung', updated_at = now()
 where slug = 'remboursement-asca-rme-naturopathie-acupuncture-suisse'
   and coalesce(title_de, '') = '';

-- (c) « # » de Markdown resté dans le champ — retiré, texte inchangé.
update public.articles set title_de = 'Lithotherapie in der Schweiz: Kristalle und energetisches Wohlbefinden', updated_at = now()
 where slug = 'lithotherapie-suisse-cristaux-bien-etre-energetique'
   and title_de = '# Lithotherapie in der Schweiz: Kristalle und energetisches Wohlbefinden';

-- Ici le défaut touche AUSSI le français : les deux champs commencent par « # ».
update public.articles set title_de = 'Wohlbefinden in der Schweiz: Geobiologie für gesundes Wohnen', updated_at = now()
 where slug = 'geobiologue-suisse-habitat-sain-bien-etre'
   and title_de = '# Wohlbefinden in der Schweiz: Geobiologie für gesundes Wohnen';

update public.articles set title_fr = 'Bien-être en Suisse : géobiologie pour habitat sain', updated_at = now()
 where slug = 'geobiologue-suisse-habitat-sain-bien-etre'
   and title_fr = '# Bien-être en Suisse : géobiologie pour habitat sain';

-- (d) Corps de l'article fuité dans le titre — tronqué à la première ligne.
update public.articles set title_de = 'Ayurveda in der Schweiz: Qualifizierte Praktiker und Therapeuten', updated_at = now()
 where slug = 'ayurveda-suisse-praticiens-therapeutes'
   and title_de like 'Ayurveda in der Schweiz: Qualifizierte Praktiker und Therapeuten%'
   and position(E'\n' in coalesce(title_de, '')) > 0;

-- (e) Mélange de langues : « in der Suisse romande » → « in der Westschweiz ».
update public.articles set title_de = 'Osteopathie und Gelenkschmerzen in der Westschweiz', updated_at = now()
 where slug = 'arthrose-douleurs-articulaires-osteopathie-massage-acupuncture-suisse'
   and title_de = 'Osteopathie und Gelenkschmerzen in der Suisse romande';

-- (f) Faute de frappe « Sophrolologie », et « zur » → « zum » (datif).
update public.articles set title_de = 'Sophrologie zum Stressabbau: Ein wirksamer Schweizer Ansatz', updated_at = now()
 where slug = 'sophrologie-suisse-gerer-stress'
   and title_de = 'Sophrolologie zur Stressabbau: Ein wirksamer Schweizer Ansatz';

-- (g) Le cas le plus coûteux, et le seul où le FRANÇAIS était fautif aussi.
--     L'article a pour slug « …zurich-bale-berne-suisse-allemande », mais son
--     titre français annonçait « Suisse romande » et l'allemand, fidèlement,
--     « Westschweiz ». Or le corps cite Zurich, Bâle, Berne, Lausanne ET Genève :
--     il couvre TOUTE la Suisse. Ni « romande » ni « Deutschschweiz » ne
--     conviennent — les deux titres visent désormais le pays entier.
update public.articles set title_fr = 'Votre annuaire de thérapeutes holistiques en Suisse', updated_at = now()
 where slug = 'therapeute-holistique-zurich-bale-berne-suisse-allemande'
   and title_fr = 'Votre annuaire-local de thérapeutes en Suisse romande';

update public.articles set title_de = 'Ihr Verzeichnis ganzheitlicher Therapeuten in der Schweiz', updated_at = now()
 where slug = 'therapeute-holistique-zurich-bale-berne-suisse-allemande'
   and title_de = 'Ihr lokales Verzeichnis für Therapeuten in der Westschweiz';

-- ── 2. Catégories orphelines ────────────────────────────────────────────────
-- Sept catégories présentes sur des articles publiés n'existaient pas dans le
-- catalogue : leur page renvoyait 404 (avant le 25/08, un soft-404 en HTTP 200).
--
-- Trois d'entre elles sont de vraies disciplines et ont été AJOUTÉES au
-- catalogue plutôt que mal classées — kinesiologie, craniosacral, eft. La
-- kinésiologie n'est pas de la kinésithérapie, la thérapie craniosacrale n'est
-- pas de l'ostéopathie : les y rattacher aurait été faux.
--
-- Les quatre restantes font doublon avec une catégorie existante, ou ne sont
-- pas une discipline. On les y rattache, ce qui concentre l'autorité au lieu de
-- la disperser sur des pages minces.

update public.articles set category = 'yoga', updated_at = now()
 where category = 'yoga-therapeutique';

update public.articles set category = 'meditation', updated_at = now()
 where category = 'meditation-pleine-conscience';

update public.articles set category = 'coaching', updated_at = now()
 where category = 'coaching-holistique';

-- « annuaire-local » n'est pas une discipline mais une étiquette éditoriale.
update public.articles set category = 'bien-etre', updated_at = now()
 where category = 'annuaire-local';
