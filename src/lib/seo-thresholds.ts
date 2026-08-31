/**
 * Seuils d'indexabilité des pages spécialité — source unique.
 *
 * ⚠️ CES SEUILS SONT DÉLIBÉRÉMENT NEUTRES AUJOURD'HUI.
 *    Les valeurs ci-dessous reproduisent EXACTEMENT le comportement actuel du
 *    site : aucune page ne bascule en noindex, aucune URL ne disparaît du
 *    sitemap du fait de ce fichier. Il est posé pour que l'activation soit un
 *    changement d'un chiffre, le jour où l'arbitrage produit est rendu.
 *
 * POURQUOI CE FICHIER EXISTE
 *   Diagnostic du 30/08/2026 (`diagnostic-donnees-holiswiss.md`) : 10 praticiens
 *   actifs engendrent 54 pages spécialité FR — 31 pages de spécialité (dont 14
 *   sans aucun praticien) et 23 pages spécialité × ville (toutes à exactement
 *   un praticien) — soit 216 URLs sur 4 langues. Le rendu est correct ; c'est le
 *   rapport pages/données qui ne l'est pas.
 *
 *   Valeurs recommandées, EN ATTENTE DE VALIDATION HUMAINE :
 *     SPECIALTY_MIN_THERAPISTS      = 1   (retire 14 × 4 = 56 URLs)
 *     SPECIALTY_CITY_MIN_THERAPISTS = 2   (retire 23 × 4 = 92 URLs)
 *   Une page spécialité × ville à un seul praticien est un sous-ensemble strict
 *   de sa fiche, décliné sur 160 mots — d'où un seuil plus exigeant que celui
 *   de la page spécialité, qui garde une valeur de définition et de maillage
 *   même à un praticien.
 *
 * DEUX RÈGLES À NE PAS ENFREINDRE EN ACTIVANT
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
 * `0` = comportement actuel : toute spécialité active est publiée, y compris
 * les 14 qui n'ont personne à montrer.
 */
export const SPECIALTY_MIN_THERAPISTS = 0;

/**
 * Idem pour `/specialites/{spec}/{ville}`.
 *
 * `1` = comportement actuel : le sitemap ne déclare une paire que si au moins
 * un praticien actif l'occupe.
 */
export const SPECIALTY_CITY_MIN_THERAPISTS = 1;

/** Une page spécialité mérite-t-elle d'être indexée avec `count` praticiens ? */
export function isSpecialtyIndexable(count: number): boolean {
  return count >= SPECIALTY_MIN_THERAPISTS;
}

/** Une page spécialité × ville mérite-t-elle d'être indexée avec `count` praticiens ? */
export function isSpecialtyCityIndexable(count: number): boolean {
  return count >= SPECIALTY_CITY_MIN_THERAPISTS;
}

/** Vrai tant que les seuils n'ont pas été relevés — sert aux tests de garde. */
export const THRESHOLDS_ARE_NEUTRAL =
  SPECIALTY_MIN_THERAPISTS === 0 && SPECIALTY_CITY_MIN_THERAPISTS === 1;
