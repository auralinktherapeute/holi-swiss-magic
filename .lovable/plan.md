
# Restructuration des spécialités thérapeutes — Plan

## Vue d'ensemble

Passer d'un `text[]` non structuré (`therapists.specialties`) à une vraie taxonomie **famille → spécialité** en base, avec 4 familles principales, recherche floue (synonymes, accents, singulier/pluriel), et pages SEO indexables pour familles et spécialités.

## 1. Base de données (migration)

Créer 3 tables + backfill :

- **`specialty_families`** : `id`, `slug` (unique), `name_fr/de/it/en`, `description_fr`, `sort_order`, `is_featured` (les 4 principales)
- **`specialties`** : `id`, `family_id` (FK), `slug` (unique), `name_fr/de/it/en`, `description_fr`, `aliases text[]` (synonymes normalisés pour la recherche), `is_active`, `is_featured`
- **`therapist_specialties`** : pivot `therapist_id` + `specialty_id` (PK composite)

Fonction Postgres `normalize_search(text)` (unaccent + lowercase + trim) + fonction `search_specialties(q text)` qui match sur `name` et `aliases` avec ranking par pertinence.

**Seed initial** :
- Famille 1 *Thérapies psychocorporelles* — sophrologie, hypnose, EMDR, psychothérapie, accompagnement-psy, relaxation
- Famille 2 *Médecines naturelles* — naturopathie, phytothérapie, aromathérapie, fleurs-de-bach, nutrition, micronutrition, ayurveda, medecine-chinoise
- Famille 3 *Corps et énergie* — réflexologie, shiatsu, acupuncture, ostéopathie, massage-bien-etre, reiki, magnétisme, massothérapie, lithothérapie, radiesthésie
- Famille 4 *Développement personnel & expression* — coaching-de-vie, méditation, yoga, art-thérapie, breathwork, sonothérapie

Chaque spécialité reçoit ses `aliases` (ex. `sophrologie` → `["sophro","sophrologue"]`, `psychothérapie` → `["psy","psychotherapeute","psychotherapie"]`, `massothérapie` → `["masso","masseur"]`).

**Backfill** : mapping fuzzy des `therapists.specialties` existants vers les spécialités seedées via aliases + fallback "à mapper manuellement" (log dans une table `specialty_import_pending`). Colonne `therapists.specialties` conservée en lecture (compat) mais nouveaux ajouts via la pivot.

GRANTs : `SELECT` anon sur les 3 tables (lecture publique), `INSERT/UPDATE/DELETE` réservé aux admins via RLS.

## 2. UI annuaire — `/[lang]/therapeutes`

Refonte de la barre du haut :
- **4 cartes familles** (icône + nom + count thérapeutes) — grid 2x2 mobile, 4 cols desktop
- **Barre recherche spécialité** avec autocomplete (Command component shadcn, appel `search_specialties` debounced 200ms)
- Lien discret **"Voir toutes les spécialités"** → drawer/modal listant tout, groupé par famille + tri A→Z
- Chips actifs (famille ou spécialité sélectionnée) avec bouton clear

Filtre appliqué à la liste existante : `therapists.specialties` OU pivot `therapist_specialties` (union pendant la période de backfill).

## 3. Pages SEO

Nouvelles routes TanStack :
- `/$lang/therapeutes/famille/$familySlug` — hero + description + liste spécialités de la famille + thérapeutes
- `/$lang/specialites/$specialtySlug` — hero + description + thérapeutes pratiquant cette spécialité + spécialités proches (même famille)
- Route GEO préparée : `/$lang/specialites/$specialtySlug/$citySlug` — indexable seulement si ≥ 1 thérapeute (sinon `noindex`)

Chaque page :
- `head()` : title unique, description, canonical self, hreflang, JSON-LD `BreadcrumbList` + `CollectionPage`
- Breadcrumbs UI
- Contenu introductif (depuis `description_fr` en base, éditable)

**Sitemap** : ajout des URLs familles + spécialités actives.

**`noindex`** sur les résultats de recherche libre (`?q=…`) via `<meta robots="noindex, follow">`.

## 4. Admin (léger)

Section `/admin/parametres` → onglet "Taxonomie spécialités" :
- CRUD familles + spécialités (nom, slug, description, aliases, is_active)
- Liste des mappings en attente (specialty_import_pending) pour reclassement manuel

## Détails techniques

**Recherche floue** : `normalize_search()` s'appuie sur l'extension `unaccent` (déjà activable). Query : `SELECT s.* FROM specialties s WHERE normalize_search(s.name_fr) LIKE '%'||normalize_search($1)||'%' OR EXISTS (SELECT 1 FROM unnest(s.aliases) a WHERE normalize_search(a) LIKE '%'||normalize_search($1)||'%') ORDER BY (normalize_search(s.name_fr) = normalize_search($1)) DESC, length(s.name_fr) ASC LIMIT 10`.

**Server fn** : `searchSpecialties({ q })`, `getFamilyPage({ slug })`, `getSpecialtyPage({ slug, city? })` dans `src/lib/specialties.functions.ts` (publiques, publishable client, RLS anon).

**i18n** : seed FR d'abord, colonnes DE/IT/EN nullable, fallback FR côté UI.

**Non-fait volontairement** (à confirmer si tu veux les inclure) :
- Traductions DE/IT/EN complètes des noms/descriptions
- Génération auto des pages GEO pour toutes les villes suisses
- Refonte du profil thérapeute pour éditer ses spécialités via la nouvelle pivot (les thérapeutes continueront à voir l'ancien champ jusqu'au sprint suivant)
