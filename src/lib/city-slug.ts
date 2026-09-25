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

export type CityRow = {
  slug: string | null;
  canonical_name: string | null;
  aliases: string[] | null;
};

/**
 * Slug CANONIQUE d'une ville, d'après la table `cities` (slug, nom canonique,
 * alias) — même règle pour le sitemap, la page `/therapeutes/ville/{slug}` et
 * les liens internes, pour qu'aucun des trois ne diverge.
 *
 * Tolérant : une ville absente de `cities` garde sa slugification directe.
 * Exemples (données du 25/09/2026) : « Bienne » → `biel-bienne`,
 * « Genève » / « ge » / « geneva » → `geneve`, « Le Grand Saconnex » →
 * `le-grand-saconnex` (absente de la table).
 *
 * À collision d'alias, la première ville lue l'emporte (ordre de la table),
 * comme le faisait le sitemap.
 */
export function buildCitySlugResolver(rows: ReadonlyArray<CityRow> | null | undefined) {
  const byKey = new Map<string, string>();
  for (const c of rows ?? []) {
    if (!c?.slug) continue;
    for (const key of [c.slug, c.canonical_name, ...(c.aliases ?? [])]) {
      const k = cityToSlug(key ?? "");
      if (k && !byKey.has(k)) byKey.set(k, c.slug);
    }
  }
  /** `null` si la ville n'est pas dans `cities`. */
  const strict = (raw: string): string | null => byKey.get(cityToSlug(raw ?? "")) ?? null;
  /** Repli sur la slugification directe. */
  const tolerant = (raw: string): string => strict(raw) ?? cityToSlug(raw ?? "");
  return { strict, tolerant };
}
