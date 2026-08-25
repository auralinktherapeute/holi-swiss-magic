/**
 * Slug de ville — source unique.
 *
 * POURQUOI CE FICHIER EXISTE
 *   Le 25/08/2026, une tentative de déduplication des alias de ville a redirigé
 *   en 301 des URL du sitemap (/fr/specialites/hypnose/geneve) vers des URL qui
 *   n'y figuraient pas (/geneva). Cause : deux sources de vérité concurrentes.
 *     · le sitemap construit ses slugs depuis `therapists.city` → « Genève » → geneve
 *     · la RPC `resolve_city` renvoie `canonical_name = 'Geneva'` (anglais)
 *       et `display_name = 'Genève, Suisse'` — aucun des deux ne redonne `geneve`.
 *
 *   Toute logique d'URL de ville doit donc passer par CETTE fonction, et par elle
 *   seule. Ne jamais slugifier `canonical_name` ni `display_name` : ils ne
 *   décrivent pas l'URL publique.
 *
 * ⚠️ Changer cette fonction change des URL déjà indexées. Les tests de
 *    `city-slug.test.ts` verrouillent le comportement attendu.
 */
export function cityToSlug(city: string): string {
  return city
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
