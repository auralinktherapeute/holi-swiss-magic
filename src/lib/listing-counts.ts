/**
 * Effectifs des pages d'annuaire (ville, canton, spécialité, famille) — calcul
 * PUR, sans réseau, partagé par le sitemap et les tests.
 *
 * POURQUOI CE FICHIER EXISTE
 *   Depuis le 29/09/2026, une page ville / canton / spécialité / famille n'est
 *   indexable et déclarée au sitemap qu'à partir de 2 fiches actives
 *   (`seo-thresholds.ts`). La route décide avec la longueur de la liste qu'elle
 *   AFFICHE ; le sitemap, qui ne rend pas les pages, doit retrouver exactement
 *   le même nombre à partir des mêmes lignes. Chaque fonction ci-dessous
 *   reproduit donc, filtre pour filtre, la lecture d'une route :
 *
 *     ville       ← `listTherapistsByCity`    (geo-listings.functions.ts)
 *     canton      ← `listTherapistsByCanton`  (geo-listings.functions.ts)
 *     spécialité  ← `getSpecialtyPage`        (specialties.functions.ts)
 *     famille     ← `getFamilyPage`           (specialties.functions.ts)
 *
 *   Si l'une de ces lectures change de filtre, la fonction correspondante doit
 *   changer avec elle — sinon le sitemap annoncera une page `noindex`, ou
 *   taira une page indexable.
 */
import { buildCitySlugResolver, type CityRow } from "@/lib/city-slug";
import { isCantonCode } from "@/lib/geo-listings";

/** Colonnes minimales d'une fiche, telles que les lit le sitemap. */
export type CountableTherapist = {
  id: string;
  slug: string | null;
  city: string | null;
  canton: string | null;
  /** `status` si connu ; absent = déjà filtré sur `active` par la requête. */
  status?: string | null;
};

const isActive = (t: CountableTherapist) => t.status === undefined || t.status === "active";

/**
 * Fiches par ville, clé = slug canonique `/therapeutes/ville/{slug}`.
 *
 * Même filtre que `listTherapistsByCity` : actives, `city` non nulle, `slug`
 * non nul ; rattachement par `resolver.tolerant(city)`. Une fiche sans slug
 * n'est PAS affichée par la page (elle serait un lien mort) : elle ne compte pas.
 */
export function countTherapistsByCity(
  therapists: ReadonlyArray<CountableTherapist>,
  cities: ReadonlyArray<CityRow> | ReturnType<typeof buildCitySlugResolver>,
): Map<string, number> {
  const resolver = Array.isArray(cities)
    ? buildCitySlugResolver(cities as ReadonlyArray<CityRow>)
    : (cities as ReturnType<typeof buildCitySlugResolver>);
  const out = new Map<string, number>();
  for (const t of therapists) {
    if (!isActive(t) || !t.slug || t.city === null) continue;
    const key = resolver.tolerant(t.city);
    if (!key) continue;
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}

/**
 * Fiches par canton, clé = code `/therapeutes/canton/{CODE}`.
 *
 * Même filtre que `listTherapistsByCanton` : actives, `slug` non nul, et
 * `canton` ÉGAL au code en majuscules (la requête fait `.eq("canton", CODE)` —
 * une valeur « vd » en base n'apparaîtrait pas sur `/canton/VD`). Seuls les
 * codes connus de la route (`isCantonCode`, sinon 404) sont retenus.
 */
export function countTherapistsByCanton(
  therapists: ReadonlyArray<CountableTherapist>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of therapists) {
    if (!isActive(t) || !t.slug) continue;
    const code = t.canton ?? "";
    if (code !== code.toUpperCase() || !isCantonCode(code)) continue;
    out.set(code, (out.get(code) ?? 0) + 1);
  }
  return out;
}

/** Ligne du pivot `therapist_specialties`, réduite aux identifiants. */
export type PivotRow = { therapist_id: string; specialty_id: string };

/**
 * Praticiens DISTINCTS par spécialité (clé = `specialties.id`).
 *
 * Même filtre que `getSpecialtyPage` : toute ligne du pivot dont le praticien
 * est actif — ni ville, ni coordonnées, ni slug exigés (la page n'en exige
 * pas). ⚠️ Différent des paires spécialité × ville, qui passent par un rayon
 * géographique et exigent donc des coordonnées.
 *
 * `activeIds` = identifiants des fiches `status = 'active'`.
 */
export function countTherapistsBySpecialty(
  pivot: ReadonlyArray<PivotRow>,
  activeIds: ReadonlySet<string>,
): Map<string, number> {
  const sets = new Map<string, Set<string>>();
  for (const p of pivot) {
    if (!activeIds.has(p.therapist_id)) continue;
    let s = sets.get(p.specialty_id);
    if (!s) sets.set(p.specialty_id, (s = new Set()));
    s.add(p.therapist_id);
  }
  return new Map([...sets].map(([k, s]) => [k, s.size]));
}

/**
 * Praticiens DISTINCTS par famille (clé = `specialty_families.id`).
 *
 * Même filtre que `getFamilyPage` : fiches actives rattachées à au moins une
 * spécialité ACTIVE de la famille. Un praticien présent dans deux spécialités
 * de la même famille compte une fois — la page le liste une fois.
 *
 * `activeSpecs` = spécialités `is_active = true` (id → family_id).
 */
export function countTherapistsByFamily(
  pivot: ReadonlyArray<PivotRow>,
  activeIds: ReadonlySet<string>,
  activeSpecs: ReadonlyArray<{ id: string; family_id: string | null }>,
): Map<string, number> {
  const familyOf = new Map<string, string>();
  for (const s of activeSpecs) if (s.family_id) familyOf.set(s.id, s.family_id);
  const sets = new Map<string, Set<string>>();
  for (const p of pivot) {
    if (!activeIds.has(p.therapist_id)) continue;
    const fam = familyOf.get(p.specialty_id);
    if (!fam) continue;
    let s = sets.get(fam);
    if (!s) sets.set(fam, (s = new Set()));
    s.add(p.therapist_id);
  }
  return new Map([...sets].map(([k, s]) => [k, s.size]));
}
