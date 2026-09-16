# Audit SEO/GEO — lecture seule, aucune modification

Périmètre : tout le contenu public (accueil, pages statiques, listes, fiches, blog, Voix d'experts, Fil Holiswiss, événements, pages visibilité, sitemap, robots, llms).
Méthode : lecture du code du commit courant. Aucun fichier, aucune base, aucune donnée n'a été touché.

## 1. Déjà correct (vérifié dans le code)

- **SSR** : aucune route publique en `ssr: false` ni `data-only`. Titres, descriptions, contenus et JSON-LD sont produits dans `head()` / loaders, donc présents dans le HTML initial.
- **Entité unique** : `src/lib/organization-schema.ts` centralise `Organization` + `WebSite` avec `@id` stables, logo réel servi depuis le domaine, `SearchAction`, `knowsLanguage`, `areaServed`, SIREN en ISO 6523. `sameAs` volontairement vide.
- **Canonical / hreflang** : `src/lib/seo.ts` (`canonicalLink`, `hreflangLinks` + `x-default`) utilisé par les pages multilingues ; les contenus mono-langues (fiches, événements, Voix d'experts) canonicalisent vers une seule langue **sans** hreflang — choix cohérent.
- **Sitemap** (`src/routes/sitemap[.]xml.ts`) : échec bruyant en 503 + `no-store`, plancher de vraisemblance, `lastmod` issus des données, `Last-Modified`/`ETag`, exclusion des pages `noindex` (mentions légales), seuils d'indexabilité, exclusion des paires spécialité × ville sans praticien géolocalisé.
- **JSON-LD riche** : fiche thérapeute (Person + Service + AggregateRating/Review réels + HealthAndBeautyBusiness + FAQPage + BreadcrumbList + `hasCredential` limité aux certifications réellement `verified`), blog (Article + Breadcrumb + publisher partagé + `datePublished`/`dateModified`/`image`), FAQ, tarifs, contact, canton, ville, annuaire (CollectionPage + ItemList + Breadcrumb).
- **Robots** : `/admin`, `/dashboard`, authentification bloqués dans **tous** les groupes ; GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended explicitement autorisés ; `Sitemap:` déclaré.
- **Terminologie** : les textes publics disent « profils validés par Holiswiss » / « inscription validée manuellement », jamais « thérapeutes certifiés ».

## 2. Manques prouvés

| # | Constat | Preuve (fichier) | Gravité |
|---|---|---|---|
| A | **Le Fil Holiswiss est absent du sitemap** : ni l'index, ni les billets, ni les catégories. Aucune occurrence de `fil-holiswiss` dans le générateur | `src/routes/sitemap[.]xml.ts` | Élevée |
| B | `/{lang}/lettre/{slug}` et `/{lang}/blog/qu-est-ce-que-la-sophrologie` absents du sitemap | idem | Moyenne |
| C | **Twitter Card fuit du layout racine** : `twitter:title` / `twitter:description` en français sont posés dans `__root.tsx` ; les pages qui ne les redéfinissent pas (blog, Voix d'experts, Fil, spécialités, familles…) servent un aperçu Twitter/X **en français sur les pages DE/IT/EN** | `src/routes/__root.tsx` l. 77-78 | Moyenne |
| D | `og:image` posé sur `__root.tsx` pointe une **capture d'écran de prévisualisation** (`…lovable.app-1781045501960.png` sur `r2.dev`), pas un visuel de marque | `__root.tsx` l. 79-80 | Moyenne |
| E | **Voix d'experts** : Article sans `image` (champ requis du résultat enrichi), sans `dateModified`, sans `@id`, sans BreadcrumbList ; page sans `og:image`/`twitter:*` | `$lang.paroles.$slug.tsx` | Moyenne |
| F | **Fil Holiswiss (billet)** : Article sans `publisher`, sans `dateModified`, `mainEntityOfPage` en **chaîne** au lieu d'un nœud (le défaut déjà corrigé côté blog), pas de BreadcrumbList | `$lang.fil-holiswiss.$slug.tsx` | Moyenne |
| G | **Événement** : pas de BreadcrumbList, pas d'`inLanguage`, pas d'`endDate`/`offers`, `organizer` redéclare une Organization « HoliSwiss » au lieu de référencer l'`@id` officiel ; `og:image` et `image` utilisent une **URL signée expirante** → aperçu social et balisage cassés après expiration | `$lang.evenements.$id.tsx` | Moyenne |
| H | **Titres blog tronqués mécaniquement** : `` `${titre} | HoliSwiss`.slice(0, 60) `` coupe en plein mot ; idem événements. Et la marque y est écrite « HoliSwiss » alors que l'entité est « Holiswiss » | `$lang.blog.$slug.tsx` l. 84, `$lang.evenements.$id.tsx` l. 34 | Moyenne |
| I | Pages **spécialité** et **famille** : ni `ItemList`/`CollectionPage`, ni `twitter:*`, ni `og:image` (les pages canton/ville, elles, ont ItemList) | `$lang.specialites.$specialtySlug.index.tsx`, `$lang.therapeutes.famille.$familySlug.tsx` | Moyenne |
| J | `robots.txt` ne nomme pas les agents récents de Meta, Amazon, Common Crawl, Bing IA (`meta-externalagent`, `Amazonbot`, `CCBot`, `Bingbot`) — ils tombent dans `*`, donc autorisés, mais sans déclaration explicite ni référence à `llms.txt` | `public/robots.txt` | Faible |
| K | Audit interne de septembre : **169 pages < 250 mots** et **56 pages orphelines** — problème éditorial, hors lot technique | `docs/seo-indexing-audit-latest.md` | Élevée mais hors périmètre technique |

## 3. Correctifs purement techniques proposés (aucun texte visible, aucune URL, aucun design modifié)

Par ordre de rapport gain/effort :

1. **Sitemap** : déclarer le Fil Holiswiss (index + billets + catégories, `lastmod` issu des données du fil), `/lettre/{slug}` et la page sophrologie. — *A, B*
2. **Twitter/OG racine** : retirer `twitter:title`/`twitter:description` du layout racine (les pages posent déjà `og:title`/`og:description`) ou les faire dériver de la langue ; déplacer/remplacer `og:image` racine par un visuel de marque 1200×630 servi depuis `holiswiss.ch`. — *C, D*
3. **Voix d'experts** : ajouter `image`, `dateModified`, `@id`, `BreadcrumbList`, `og:image`/`twitter:image` quand un visuel existe. — *E*
4. **Fil Holiswiss** : `publisher: publisherNode`, `dateModified`, `mainEntityOfPage` en nœud `WebPage`, `BreadcrumbList`. — *F*
5. **Événements** : `BreadcrumbList`, `inLanguage`, `endDate`/`offers` si les colonnes existent, `organizer: { "@id": ORGANIZATION_ID }`, et pour l'image : URL publique stable plutôt qu'URL signée (sinon omettre `og:image` — un aperçu cassé est pire qu'aucun). — *G*
6. **Titres** : troncature au mot (utilitaire déjà présent : `src/lib/seo-title.ts`) et graphie de marque unifiée « Holiswiss ». — *H*
7. **Spécialité / famille** : `ItemList` + `CollectionPage` alignés sur le modèle canton/ville, `twitter:card`/`twitter:title`/`twitter:description`. — *I*
8. **robots.txt** : groupes explicites pour `meta-externalagent`, `Amazonbot`, `CCBot`, `Bingbot` reprenant **à l'identique** la liste de `*`. — *J*

Non proposé volontairement : contenu mince et pages orphelines (K) — travail éditorial, hors lot technique ; `sameAs` (aucun compte vérifié) ; toute extension du balisage de certification.

## 4. Fichiers concernés

`src/routes/sitemap[.]xml.ts` · `src/routes/__root.tsx` · `src/routes/$lang.paroles.$slug.tsx` · `src/routes/$lang.fil-holiswiss.$slug.tsx` · `src/routes/$lang.evenements.$id.tsx` · `src/routes/$lang.blog.$slug.tsx` · `src/routes/$lang.specialites.$specialtySlug.index.tsx` · `src/routes/$lang.therapeutes.famille.$familySlug.tsx` · `public/robots.txt` · éventuellement `src/lib/seo-title.ts`, `src/data/fil-holiswiss.ts` (lecture seule) et un visuel de partage dans `public/`.

## 5. Impacts et risques

- Aucune migration, aucune donnée, aucun texte visible, aucune URL, aucun composant d'interface, aucun workflow de validation manuelle touché.
- Risque n°1 : **sitemap**. Une erreur d'assemblage lève et renvoie 503 (comportement voulu) ; la vérification doit donc compter les URL avant/après.
- Risque n°2 : retirer les Twitter Cards racines fait que les pages sans `twitter:*` s'appuient sur `og:*` — comportement standard des plateformes, mais à vérifier sur une page réelle.
- Risque n°3 : un `og:image` d'événement retiré fait disparaître l'aperçu image de ces pages (choix assumé : mieux que l'aperçu cassé actuel).
- Aucun effet attendu sur les performances : tout se joue dans `head()` et le générateur de sitemap.

## 6. Tests à exécuter (au moment de l'implémentation)

1. `npm run seo:check` et `scripts/seo/audit-indexability.mjs` avant/après.
2. Sitemap local : compter les `<loc>`, vérifier +N URLs du Fil, aucune URL en 404, aucune page `noindex` déclarée.
3. HTML brut sans JavaScript, en FR/DE/IT/EN, sur : accueil, annuaire, un canton, une ville, une spécialité, une famille, une fiche, un article, une Voix d'experts, un billet du Fil, un événement, une page visibilité → un seul `<title>`, un seul `canonical`, `h1` unique, JSON-LD parsable.
4. Validation du balisage (Rich Results Test / validator.schema.org) sur un exemplaire de chaque modèle modifié.
5. Vérifier qu'aucun `aggregateRating`, badge ou « certification vérifiée » n'apparaît sans donnée réellement validée.
6. `robots.txt` relu ligne à ligne : chaque groupe nommé reprend la liste complète de `*`.
7. Suite de tests complète + build réel (statut de sortie), sans publication.

Aucune modification n'a été effectuée dans cet audit.
