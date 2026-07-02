# Finalisation taxonomie spécialités — 4 chantiers

## 1. Traductions DE / IT / EN

**Data** : une migration qui `UPDATE` les 4 familles + 31 spécialités pour remplir `name_de/it/en` et `description_fr/de/it/en` (traductions fournies via mapping en SQL, écrites à la main — pas d'appel LLM à l'exécution). Alias enrichis avec équivalents allemands courants (`hypnose`→`hypnotherapie`, `naturopathie`→`naturheilkunde`, etc.) pour que la recherche fonctionne dans les 4 langues.

**Code** :
- Helper `pickI18n(row, lang, field)` dans `src/lib/i18n.ts` (fallback FR si vide).
- `SpecialtyExplorer`, `getFamilyPage`, `getSpecialtyPage`, `search_specialties` (RPC) : passer `lang` et retourner le bon champ.
- Pages `/$lang/therapeutes/famille/$slug` et `/$lang/specialites/$slug` : titres + descriptions traduits, `hreflang` déjà présent.

## 2. Route GEO `/$lang/specialites/$slug/$city`

**Route** : `src/routes/$lang.specialites.$specialtySlug.$citySlug.tsx`.
- Loader : `getSpecialtyCityPage({ slug, city, lang })` — normalise la ville via `resolve_city`, retourne les thérapeutes actifs de cette spécialité dans un rayon de 30 km (RPC composant `therapists_within_radius` + filtre pivot).
- Indexation conditionnelle : si `therapists.length === 0` → `robots: noindex, follow` + composant "aucun thérapeute pour l'instant, découvrez la spécialité". Sinon indexable normal.
- `head()` : title `"{Spécialité} à {Ville} — Holiswiss"`, JSON-LD `BreadcrumbList` + `CollectionPage` avec `geo`, canonical self, hreflang.
- Sitemap : générer les combinaisons ayant ≥ 1 thérapeute (jointure pivot × villes distinctes tirées de `therapists.city` normalisées). Pas de combinaisons vides dans le sitemap.

## 3. Admin taxonomie

**Route** : ajouter un onglet "Taxonomie" dans `/admin/parametres` (nouveau composant `AdminSpecialtiesPanel`).

**Sections** :
- **Familles** : liste (drag pour `sort_order`), édition inline (nom FR/DE/IT/EN, slug, icon, description, is_featured).
- **Spécialités** : filtrées par famille, édition inline (nom multilingue, slug, aliases[], is_active, is_featured, changement de famille via select).
- **Reclassement pending** : liste des `specialty_import_pending` (raw_label, thérapeute), avec bouton "Rattacher à…" qui insère dans `therapist_specialties` et supprime le pending. Bouton "Ignorer" (supprime juste).

**Server fns** (admin only via `has_role admin`) dans `src/lib/specialties-admin.functions.ts` : `listAdminTaxonomy`, `saveFamily`, `saveSpecialty`, `deleteSpecialty`, `listPendingImports`, `resolvePendingImport`, `dismissPendingImport`.

## 4. Refonte profil thérapeute → pivot

**UI** : dans `/dashboard/profil` (section "Spécialités"), remplacer la recherche + tags libres par un **sélecteur groupé par famille** :
- Accordion par famille (4 sections), avec badge du nombre de spécialités cochées.
- Chip toggle par spécialité (checkbox visuelle, multi-select, min 1 requis).
- Champ recherche au-dessus qui met en surbrillance les correspondances (aliases inclus).
- Panneau récap "Vos spécialités (N)" en haut avec chips retirables.
- Aide contextuelle : "Choisissez toutes les spécialités que vous pratiquez — vous apparaîtrez dans chacune."

**Data** :
- Le formulaire manipule un `Set<specialtyId>` au lieu d'un `string[]` libre.
- `saveMyTherapistProfile` accepte désormais `specialty_ids: string[]` (optionnel, en complément de `specialties` legacy pour compat).
- Sync pivot : si `specialty_ids` fourni, remplace le pivot directement (plus besoin du matching par aliases côté serveur). Le champ `therapists.specialties` (text[]) reste rempli en miroir pour la carte publique existante (liste des labels).
- Migration légère : trigger optionnel qui maintient `therapists.specialties` à partir de la pivot pour les futurs enregistrements — **non**, on garde la sync explicite côté server fn pour rester lisible.

## Ordre d'exécution

1. Migration i18n (données) → 2. Helper `pickI18n` + intégration UI existante (annuaire + pages spécialité) → 3. Route GEO + sitemap → 4. Admin panel → 5. Refonte champ profil.

## Points techniques

- Un seul appel `supabase--migration` pour l'i18n (gros UPDATE data — passer par `supabase--insert` si migration refuse les `UPDATE` sans schéma).
- RPC `search_specialties` étendu : accepter `_lang` et matcher aliases + `name_{lang}`.
- Sitemap actuel (`src/routes/sitemap[.]xml.ts`) sera mis à jour avec les combinaisons GEO peuplées.
- Aucun changement de schéma DB (colonnes déjà nullable, aliases déjà `text[]`).
- Tests manuels : commuter langue sur `/de/therapeutes` → familles affichées en allemand ; ouvrir `/fr/specialites/sophrologie/geneve` → si thérapeute présent, indexable ; admin peut reclasser "Perte de poids" → apparaît dans les résultats correspondants ; profil thérapeute → sélection multi propre, sync annuaire immédiate.

## Non inclus

- Traduction automatique via LLM (les libellés sont écrits à la main pour rester exacts).
- Pages GEO pour toutes les villes suisses en pré-génération (seules les combinaisons peuplées sont indexées).
- Refonte des accréditations / autres champs profil (hors scope).
