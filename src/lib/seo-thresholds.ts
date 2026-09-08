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
 * `1` depuis le 07/09/2026 — arbitrage rendu par Gérald sur l'audit
 * d'indexation. Retire les 14 spécialités sans praticien (14 × 4 = 56 URLs)
 * qui servaient « 0 thérapeute en Sophrologie » sur ~160 mots, en
 * `index, follow`. Repasser à `0` republie tout, sans autre changement.
 */
export const SPECIALTY_MIN_THERAPISTS: number = 1;

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
