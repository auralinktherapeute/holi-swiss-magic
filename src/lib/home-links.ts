/**
 * Maillage interne de l'accueil — calcul PUR, sans réseau (testé dans
 * `home-links.test.ts`). Les lectures vivent dans `home-links.functions.ts`.
 *
 * POURQUOI CE FICHIER EXISTE (décision de Gérald, 29/09/2026)
 *   Le HTML serveur de l'accueil ne contenait AUCUN lien vers une fiche ni vers
 *   un article : « Nouveaux thérapeutes » et « Thérapeutes à proximité »
 *   chargeaient leurs praticiens dans le navigateur (`useQuery`). En revanche,
 *   le pied de page liait en dur 7 pages ville, dont 6 à 0 ou 1 fiche —
 *   c'est-à-dire des pages minces, `noindex` dès la fusion de la PR #22.
 *   L'accueil, page la plus forte du site, ne transmettait donc rien aux fiches
 *   et poussait des pages vides.
 */
import { buildCitySlugResolver, type CityRow } from "@/lib/city-slug";
import { resolveProfileLang, type SeoLang } from "@/lib/seo";
import { slugForLang, titleForLang } from "@/lib/articles.functions";

/** Colonnes publiques lues pour l'accueil (vérifiées sur qqwud le 29/09/2026). */
export const HOME_THERAPIST_COLUMNS =
  "id,slug,first_name,last_name,title,photo_url,city,canton,languages,verified,specialties,created_at,latitude,longitude,price_min,currency";

export type HomeTherapistRow = {
  id: string;
  slug: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  photo_url: string | null;
  city: string | null;
  canton: string | null;
  languages: string[] | null;
  verified: boolean | null;
  specialties: string[] | null;
  created_at: string | null;
  latitude: number | null;
  longitude: number | null;
  price_min: number | null;
  currency: string | null;
};

/** Fiche prête à lier : slug garanti et langue de l'URL canonique. */
export type HomeTherapist = HomeTherapistRow & { slug: string; profileLang: SeoLang };

/**
 * Langue de l'URL CANONIQUE d'une fiche — celle que déclarent le `<link
 * rel="canonical">` de la fiche et le sitemap. On passe par
 * `resolveProfileLang` SANS langue d'URL, exactement comme eux : si la règle
 * change (ex. primauté de la langue de rédaction), l'accueil suit sans
 * modification ici — à condition que l'appelant garde cette même signature.
 */
export function canonicalProfileLang(t: Pick<HomeTherapistRow, "canton" | "languages">): SeoLang {
  return resolveProfileLang(null, t.canton, t.languages);
}

/** Écarte les fiches sans slug (lien mort) et calcule leur langue canonique. */
export function toHomeTherapists(rows: ReadonlyArray<HomeTherapistRow>): HomeTherapist[] {
  const out: HomeTherapist[] = [];
  for (const r of rows) {
    const slug = (r.slug ?? "").trim();
    if (!slug) continue;
    out.push({ ...r, slug, profileLang: canonicalProfileLang(r) });
  }
  return out;
}

const time = (iso: string | null) => {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : 0;
};

/** « Nouveaux thérapeutes » : fiches AVEC photo, les plus récentes d'abord. */
export function pickNewest(list: ReadonlyArray<HomeTherapist>, n = 4): HomeTherapist[] {
  return list
    .filter((t) => (t.photo_url ?? "").trim() !== "")
    .sort((a, b) => time(b.created_at) - time(a.created_at))
    .slice(0, n);
}

/**
 * « Thérapeutes à proximité » : vérifiés d'abord, puis les plus récents —
 * ordre stable (l'ancienne requête triait sur `verified` seul, ce qui laissait
 * l'ordre des ex æquo au hasard de PostgreSQL).
 */
export function pickNearby(list: ReadonlyArray<HomeTherapist>, n = 20): HomeTherapist[] {
  return [...list]
    .sort(
      (a, b) =>
        Number(!!b.verified) - Number(!!a.verified) ||
        time(b.created_at) - time(a.created_at) ||
        a.slug.localeCompare(b.slug),
    )
    .slice(0, n);
}

/**
 * Seuil d'indexabilité d'une page ville : 2 fiches.
 *
 * ⚠️ À REMPLACER PAR `isCityIndexable` (`@/lib/seo-thresholds`) APRÈS LA
 *    FUSION DE LA PR #22 (`fix/indexation-sitemap`), qui introduit ce seuil
 *    unique — sitemap, route ville et accueil liront alors la même constante.
 *    Défini ici en attendant pour ne pas entrer en conflit avec la PR.
 */
export const HOME_CITY_MIN_THERAPISTS = 2;
export function isHomeCityIndexable(count: number): boolean {
  return count >= HOME_CITY_MIN_THERAPISTS;
}

export type HomeCityLink = { slug: string; name: string; canton: string | null; count: number };

/**
 * Villes liables depuis l'accueil : celles dont la page `/therapeutes/ville/{slug}`
 * est indexable.
 *
 * Compté EXACTEMENT comme la page ville (`listTherapistsByCity`) et comme
 * `countTherapistsByCity` de la PR #22 : fiches actives, `city` et `slug` non
 * nuls, rattachées par `resolver.tolerant(city)` (table `cities`). Un praticien
 * « Bienne » compte donc pour `biel-bienne`, comme sur la page. Le nom affiché
 * est le libellé le plus fréquent parmi les fiches de la ville.
 */
export function indexableCities(
  list: ReadonlyArray<Pick<HomeTherapistRow, "slug" | "city" | "canton">>,
  cities: ReadonlyArray<CityRow>,
): HomeCityLink[] {
  const resolver = buildCitySlugResolver(cities);
  const groups = new Map<
    string,
    { labels: Map<string, number>; canton: string | null; count: number }
  >();
  for (const t of list) {
    if (!t.slug || t.city === null) continue;
    const label = t.city.trim();
    const key = resolver.tolerant(label);
    if (!key) continue;
    const g = groups.get(key) ?? { labels: new Map(), canton: t.canton, count: 0 };
    g.count += 1;
    g.labels.set(label, (g.labels.get(label) ?? 0) + 1);
    groups.set(key, g);
  }
  return [...groups]
    .filter(([, g]) => isHomeCityIndexable(g.count))
    .map(([slug, g]) => ({
      slug,
      name: [...g.labels].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0],
      canton: g.canton,
      count: g.count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Fiches par canton, pour les pastilles de « Holiswiss dans toute la Suisse ».
 * Même calcul que l'ancienne requête navigateur de `CantonDirectory`
 * (code en majuscules, espaces retirés), désormais fait au SSR.
 */
export function cantonCounts(
  list: ReadonlyArray<Pick<HomeTherapistRow, "canton">>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of list) {
    const code = (r.canton ?? "").toUpperCase().trim();
    if (code) map[code] = (map[code] ?? 0) + 1;
  }
  return map;
}

export type HomeArticleLink = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
  publishedAt: string | null;
  cover: string | null;
  coverAlt: string | null;
};

/**
 * Derniers articles pour l'accueil, depuis la MÊME lecture que l'index du blog
 * (`getPublishedArticles`) : titre et slug dans la langue de la page, via les
 * mêmes helpers que `/blog` (`titleForLang`, `slugForLang`) — donc la même URL
 * que celle que publie le sitemap (slug_de en allemand, slug sinon).
 */
export function toHomeArticles(
  articles: ReadonlyArray<Record<string, unknown>>,
  lang: SeoLang,
  n = 6,
): HomeArticleLink[] {
  const out: HomeArticleLink[] = [];
  for (const a of articles) {
    if (out.length >= n) break;
    const slug = slugForLang(a, lang);
    const title = titleForLang(a, lang).trim();
    if (!slug || !title) continue;
    out.push({
      id: String(a.id ?? slug),
      slug,
      title,
      category: typeof a.category === "string" ? a.category : null,
      publishedAt: typeof a.published_at === "string" ? a.published_at : null,
      cover: typeof a.cover_image_url === "string" && a.cover_image_url ? a.cover_image_url : null,
      coverAlt: typeof a.image_alt_text === "string" ? a.image_alt_text : null,
    });
  }
  return out;
}
