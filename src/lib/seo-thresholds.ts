/**
 * Seuils d'indexabilité des pages d'annuaire (spécialité, spécialité × ville,
 * ville, canton, famille) et des catégories du blog — source unique.
 *
 * ── DÉCISION DU 29/09/2026 (Gérald, audit Search Console) ─────────────────────
 *   Search Console relevait 443 URL au sitemap pour 11–13 fiches actives, la
 *   plupart « Découverte – non indexée » ou « Inconnue de Google ». Un sitemap
 *   qui annonce des dizaines de pages à une seule fiche dilue le budget de
 *   crawl d'un petit site et habitue Google à y trouver des pages minces.
 *   Arbitrage : une page ville, canton, spécialité ou famille n'est indexable
 *   ET déclarée au sitemap qu'à partir de DEUX fiches actives. Au-dessous, la
 *   page reste servie (200), liée depuis le site, mais émet `noindex,follow` —
 *   décidé dans le LOADER — et disparaît du sitemap. Jamais l'un sans l'autre.
 *   Les effectifs sont comptés par `listing-counts.ts`, qui reproduit filtre
 *   pour filtre la lecture de chaque route.
 *
 *   Effet mesuré sur qqwud le 29/09 (74 spécialités actives, 13 fiches) :
 *   sitemap 453 → 381 URL. Spécialités 15 → 7, villes 9 → 1, cantons 4 → 2,
 *   familles 4 → 4 (détail dans `seo-thresholds.test.ts`).
 *
 * ── HISTORIQUE ─────────────────────────────────────────────────────────────
 *   30/08/2026 — fichier posé avec des seuils NEUTRES (aucun effet), pour que
 *   l'activation tienne en un chiffre. Diagnostic de l'époque
 *   (`diagnostic-donnees-holiswiss.md`) : 10 praticiens, 31 spécialités
 *   actives dont 14 sans praticien, 23 paires spécialité × ville à un seul
 *   praticien. Le référentiel compte 74 spécialités actives au 29/09/2026.
 *   07/09/2026 — activation : spécialité ≥ 1, paire spécialité × ville ≥ 2
 *   (600 → 448 URL).
 *   29/09/2026 — tout à 2 (ci-dessus). `THRESHOLDS_ARE_NEUTRAL` reste exporté
 *   pour le test de garde ; il vaut `false` depuis le 07/09.
 *
 * DEUX RÈGLES À NE PAS ENFREINDRE
 *   1. La décision se calcule DANS LE LOADER, jamais dans `head`. Le 25/08/2026,
 *      une condition d'indexation posée dans `head` lisait des données absentes
 *      à ce niveau et a basculé en noindex TOUTES les pages spécialité × ville,
 *      y compris les valides. Le bon motif est celui de
 *      `$lang.blog.categorie.$slug.tsx` (MIN_ARTICLES_INDEXABLE).
 *   2. Le sitemap et la route lisent CE fichier, et lui seul. Deux seuils qui
 *      divergent, c'est un sitemap qui annonce une page noindex — la règle déjà
 *      inscrite dans `sitemap[.]xml.ts`.
 */

/**
 * Nombre minimum de praticiens actifs pour qu'une page `/specialites/{spec}`
 * soit indexable et déclarée au sitemap.
 *
 * `2` depuis le 29/09/2026 (audit Search Console, voir en tête de fichier).
 * Auparavant `1` (07/09/2026), qui retirait les spécialités sans praticien.
 * À un seul praticien, la page spécialité répète sa fiche.
 * Compté comme `getSpecialtyPage` : praticiens actifs du pivot, sans condition
 * de ville ni de coordonnées (`countTherapistsBySpecialty`).
 */
export const SPECIALTY_MIN_THERAPISTS: number = 2;

/**
 * Idem pour `/specialites/{spec}/{ville}`.
 *
 * `2` depuis le 07/09/2026. Une page spécialité × ville à un seul praticien est
 * un sous-ensemble strict de sa fiche décliné sur ~160 mots : elle concurrence
 * la fiche sans rien apporter. Retire les 23 paires actuelles (23 × 4 = 92 URLs)
 * et les laissera revenir d'elles-mêmes dès qu'une ville comptera deux
 * praticiens de la même spécialité.
 */
export const SPECIALTY_CITY_MIN_THERAPISTS: number = 2;

/**
 * Nombre minimum d'articles pour qu'une page `/blog/categorie/{slug}` soit
 * indexable, déclarée au sitemap — et LIÉE depuis le blog et les articles.
 *
 * La valeur `3` existait déjà, mais écrite EN DUR à deux endroits :
 * `$lang.blog.categorie.$slug.tsx` et `sitemap[.]xml.ts`. Le maillage interne
 * ajouté le 08/09 en aurait fait un troisième. Or deux seuils qui divergent,
 * c'est un sitemap qui annonce une page noindex — ou, ici, un lien interne qui
 * pointe vers une page noindex. Une seule définition, trois lecteurs.
 */
export const ARTICLE_CATEGORY_MIN_ARTICLES = 3;

/** Une catégorie de blog mérite-t-elle d'être indexée et liée avec `count` articles ? */
export function isCategoryIndexable(count: number): boolean {
  return count >= ARTICLE_CATEGORY_MIN_ARTICLES;
}

/** Une page spécialité mérite-t-elle d'être indexée ? (règle `isListingIndexable`) */
export function isSpecialtyIndexable(facts: ListingFacts): boolean {
  return isListingIndexable("specialty", facts);
}

/** Une page spécialité × ville mérite-t-elle d'être indexée avec `count` praticiens ? */
export function isSpecialtyCityIndexable(count: number): boolean {
  return count >= SPECIALTY_CITY_MIN_THERAPISTS;
}

/**
 * `/therapeutes/ville/{slug}` — indexable et au sitemap à partir de 2 fiches
 * (29/09/2026). Compté comme `listTherapistsByCity` (`countTherapistsByCity`).
 */
export const CITY_MIN_THERAPISTS: number = 2;

/**
 * `/therapeutes/canton/{CODE}` — indexable et au sitemap à partir de 2 fiches
 * (29/09/2026). Compté comme `listTherapistsByCanton` (`countTherapistsByCanton`).
 */
export const CANTON_MIN_THERAPISTS: number = 2;

/**
 * `/therapeutes/famille/{slug}` — indexable et au sitemap à partir de 2
 * praticiens distincts (29/09/2026). Compté comme `getFamilyPage`
 * (`countTherapistsByFamily`).
 */
export const FAMILY_MIN_THERAPISTS: number = 2;

/** Une page ville mérite-t-elle d'être indexée avec `count` fiches ? */
export function isCityIndexable(count: number): boolean {
  return isListingIndexable("city", { profiles: count });
}

/** Une page canton mérite-t-elle d'être indexée ? (règle `isListingIndexable`) */
export function isCantonIndexable(facts: ListingFacts): boolean {
  return isListingIndexable("canton", facts);
}

/** Une page famille mérite-t-elle d'être indexée ? (règle `isListingIndexable`) */
export function isFamilyIndexable(facts: ListingFacts): boolean {
  return isListingIndexable("family", facts);
}

// ── RÈGLE D'INDEXATION DES PAGES D'ANNUAIRE — décision du 07/10/2026 ──────────
//
// Validée par Gérald (étape 3/7). UNE règle, lue par les routes ET le sitemap.
// index,follow seulement si TOUTES les conditions de son type sont remplies :
//   · tous types : ≥ 2 fiches actives distinctes publiées ;
//   · spécialité, canton : ≥ 2 villes différentes OU ≥ 3 fiches ;
//   · famille : ≥ 2 spécialités réellement représentées ;
//   · ville : 2 fiches suffisent ;
//   · spécialité, famille : description propre non vide (après trim) dans la
//     langue de la page — jamais le repli français.
// Sinon : 200 noindex,follow, hors sitemap, sans JSON-LD ni hreflang.
export type ListingKind = "specialty" | "canton" | "city" | "family";
export type ListingFacts = {
  /** Fiches actives distinctes, avec slug. */
  profiles: number;
  /** Villes distinctes parmi ces fiches (spécialité, canton). */
  distinctCities?: number;
  /** Spécialités représentées par au moins une fiche active (famille). */
  representedSpecialties?: number;
  /** Description propre dans la langue de la page (spécialité, famille). */
  description?: string | null;
};
export const LISTING_MIN_PROFILES = 2;
export const LISTING_DIVERSITY_MIN_CITIES = 2;
export const LISTING_DIVERSITY_MIN_PROFILES = 3;
export const FAMILY_MIN_REPRESENTED_SPECIALTIES = 2;

export function hasOwnDescription(d: unknown): boolean {
  return typeof d === "string" && d.trim().length > 0;
}

/** Description dans la langue EXACTE (`description_<lang>`), sans repli. */
export function ownDescription(row: unknown, lang: string): string | null {
  const v = (row as Record<string, unknown> | null | undefined)?.[`description_${lang}`];
  return hasOwnDescription(v) ? (v as string) : null;
}

export function isListingIndexable(kind: ListingKind, f: ListingFacts): boolean {
  if (!(f.profiles >= LISTING_MIN_PROFILES)) return false;
  switch (kind) {
    case "city":
      return true;
    case "canton":
      return (f.distinctCities ?? 0) >= LISTING_DIVERSITY_MIN_CITIES || f.profiles >= LISTING_DIVERSITY_MIN_PROFILES;
    case "specialty":
      return (
        ((f.distinctCities ?? 0) >= LISTING_DIVERSITY_MIN_CITIES || f.profiles >= LISTING_DIVERSITY_MIN_PROFILES) &&
        hasOwnDescription(f.description)
      );
    case "family":
      return (f.representedSpecialties ?? 0) >= FAMILY_MIN_REPRESENTED_SPECIALTIES && hasOwnDescription(f.description);
  }
}

/** Fiches distinctes (avec slug) et villes distinctes, comptées pareil partout. */
export function profileFacts(
  list: ReadonlyArray<{ id?: string | null; slug?: string | null; city?: string | null }>,
): { profiles: number; distinctCities: number } {
  const ids = new Set<string>();
  const cities = new Set<string>();
  for (const t of list) {
    if (!t?.slug) continue;
    const key = t.id ?? t.slug;
    if (ids.has(key)) continue;
    ids.add(key);
    const c = (t.city ?? "")
      .toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (c) cities.add(c);
  }
  return { profiles: ids.size, distinctCities: cities.size };
}

/** Langues où la page est indexable : seules elles portent des hreflang. */
export function indexableLangs<L extends string>(
  langs: ReadonlyArray<L>,
  decide: (lang: L) => boolean,
): L[] {
  return langs.filter((l) => decide(l));
}

/** Vrai tant que les seuils n'ont pas été relevés — sert aux tests de garde. */
export const THRESHOLDS_ARE_NEUTRAL =
  SPECIALTY_MIN_THERAPISTS === 0 && SPECIALTY_CITY_MIN_THERAPISTS === 1;
