/**
 * Ville d'une fiche thérapeute — normalisation et contrôle de cohérence avec le NPA.
 *
 * POURQUOI CE FICHIER EXISTE
 *   Le 25/09/2026, une fiche publiée portait `city = "acacias"` : un quartier
 *   (localité postale « Les Acacias »), en minuscules, au lieu de la commune.
 *   D'autres fiches portent « Bienne » (commune : « Biel/Bienne »), « Le Grand
 *   Saconnex » (commune : « Le Grand-Saconnex ») ou un NPA d'un autre canton
 *   (« Basel » avec 4500, qui est Soleure).
 *
 * RÉFÉRENTIEL
 *   Répertoire officiel des localités de swisstopo (NPA ↔ localité ↔ commune ↔
 *   canton), embarqué dans `src/data/swiss-npa.generated.ts` et chargé par
 *   `src/lib/swiss-npa.ts`. Ce module ne dépend PAS du référentiel réel : toutes
 *   les fonctions reçoivent un `NpaIndex`, ce qui les rend testables et
 *   utilisables côté serveur comme côté navigateur.
 *
 * ⚠️ URL : la ville alimente `cityToSlug()` (src/lib/city-slug.ts), donc les URL
 *    `/ville/…` et `/specialites/…/{ville}`. Normaliser une ville à la sauvegarde
 *    peut changer son slug (« Bienne » → biel-bienne). Rien ici ne réécrit les
 *    données existantes : la normalisation s'applique à la prochaine sauvegarde.
 */

// ---------------------------------------------------------------------------
// Référentiel
// ---------------------------------------------------------------------------

export type NpaCommune = {
  npa: string;
  /** Nom OFS de la commune, tel quel (« Carouge (GE) »). */
  officialName: string;
  /** Nom à enregistrer dans `therapists.city` (« Carouge » : suffixe de canton retiré). */
  name: string;
  canton: string;
  /** Poids relatif dans le NPA (‰ d'adresses de la localité principale) — sert au tri. */
  weight: number;
  /** Localités postales du NPA rattachées à cette commune (« Les Acacias »…). */
  localities: string[];
};

export type NpaIndex = {
  byNpa: Map<string, NpaCommune[]>;
  /** cityKey(nom de commune) → communes portant ce nom (tous NPA confondus). */
  byCommuneKey: Map<string, NpaCommune[]>;
};

const CANTON_SUFFIX = /\s+\((AG|AI|AR|BE|BL|BS|FR|GE|GL|GR|JU|LU|NE|NW|OW|SG|SH|SO|SZ|TG|TI|UR|VD|VS|ZG|ZH)\)$/;

/** « Carouge (GE) » → « Carouge » ; « Beinwil (Freiamt) » reste tel quel. */
export function communeDisplayName(officialName: string, canton: string): string {
  const m = officialName.match(CANTON_SUFFIX);
  return m && m[1] === canton ? officialName.replace(CANTON_SUFFIX, "") : officialName;
}

/** Construit l'index à partir du TSV généré (NPA, commune, canton, poids, localités). */
export function parseNpaTsv(tsv: string): NpaIndex {
  const byNpa = new Map<string, NpaCommune[]>();
  const byCommuneKey = new Map<string, NpaCommune[]>();
  for (const line of tsv.split("\n")) {
    if (!line) continue;
    const [npa, officialName, canton, weight, locField] = line.split("\t");
    const entry: NpaCommune = {
      npa,
      officialName,
      name: communeDisplayName(officialName, canton),
      canton,
      weight: Number(weight) || 0,
      localities: locField === "=" ? [officialName] : (locField ?? "").split("|").filter(Boolean),
    };
    const list = byNpa.get(npa);
    if (list) list.push(entry);
    else byNpa.set(npa, [entry]);
    for (const k of new Set([cityKey(entry.name), cityKey(officialName)])) {
      const l = byCommuneKey.get(k);
      if (l) l.push(entry);
      else byCommuneKey.set(k, [entry]);
    }
  }
  return { byNpa, byCommuneKey };
}

/** Communes d'un NPA, triées par poids décroissant. Vide si NPA inconnu. */
export function communesForNpa(index: NpaIndex, npa: string): NpaCommune[] {
  return index.byNpa.get(npa) ?? [];
}

/** Communes distinctes (dédupliquées par nom + canton) d'une liste. */
export function uniqueCommunes(list: NpaCommune[]): NpaCommune[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = `${c.name}|${c.canton}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Normalisation de saisie (sans référentiel)
// ---------------------------------------------------------------------------

/**
 * Clé de comparaison : minuscules, sans accents, ponctuation → espace, et
 * « saint / sainte / st / ste / sankt / san / santa » unifiés en « st »
 * (« St-Prex » = « Saint-Prex », « Saint-Moritz » = « St. Moritz »).
 * Seuls des MOTS entiers sont touchés : « Sion », « Stein am Rhein » restent intacts.
 */
export function cityKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/(^| )(saint|sainte|st|ste|sankt|san|santa)(?= |$)/g, "$1st");
}

export function withoutArticle(key: string): string {
  return key.replace(/^(le|la|les|l)\s+/, "");
}

// Un séparateur (virgule, parenthèse, espace…) est exigé avant le mot : sans
// lui, « Rorschach » perdrait son « ch » final.
export const COUNTRY_SUFFIX = /(?:\s*[,;/]\s*|\s+-\s*|\s*\(\s*|\s+)(suisse|schweiz|switzerland|svizzera|svizra|ch)\s*\)?\s*$/i;

/**
 * Particules qui restent en minuscules à l'intérieur d'un nom composé
 * (« La Chaux-de-Fonds », « Villars-sur-Glâne », « Stein am Rhein »).
 * Jamais appliqué au premier mot.
 */
const PARTICLES = new Set([
  "de", "du", "des", "d", "la", "le", "les", "l", "sur", "sous", "en", "et", "lès",
  "am", "an", "im", "bei", "ob", "und", "unter", "auf",
  "di", "da", "del", "della", "dei", "al", "sopra", "sotto",
]);

function capitalizeSegment(seg: string, isFirst: boolean): string {
  if (!seg) return seg;
  // Un segment qui contient déjà une majuscule est laissé tel quel
  // (« St. Gallen », « McX », sigles) : on ne corrige que le tout-minuscule.
  if (seg !== seg.toLowerCase()) return seg;
  if (!isFirst && PARTICLES.has(seg)) return seg;
  return seg.charAt(0).toLocaleUpperCase("fr-CH") + seg.slice(1);
}

/**
 * Normalisation de forme, sans référentiel :
 *  - espaces de bord et multiples ;
 *  - suffixe pays retiré (« , Suisse », « , Schweiz », « , Switzerland », « , Svizzera », « CH ») ;
 *  - majuscule initiale sur les segments en minuscules, en respectant les noms
 *    composés (espaces, traits d'union, « / », apostrophes) et les particules.
 */
export function normalizeCityInput(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/\s+/g, " ").trim();
  // Le suffixe pays peut être répété (« Genève, Suisse, CH ») : on boucle.
  for (let i = 0; i < 3; i++) {
    const next = s.replace(COUNTRY_SUFFIX, "").trim();
    if (next === s || !next) break;
    s = next;
  }
  s = s.replace(/\s*,\s*$/, "").replace(/\s*-\s*/g, "-").replace(/\s*\/\s*/g, "/");
  let first = true;
  // On découpe en conservant les séparateurs.
  return s
    .split(/([\s\-/'’]+)/)
    .map((part) => {
      if (/^[\s\-/'’]+$/.test(part) || part === "") return part;
      const out = capitalizeSegment(part, first);
      first = false;
      return out;
    })
    .join("");
}

/** « CH-1227 », « 1227 » → « 1227 » ; tout le reste → chaîne nettoyée telle quelle. */
export function normalizePostalCode(raw: string | null | undefined): string {
  const s = String(raw ?? "").replace(/\s+/g, "").trim();
  const m = s.match(/^(?:CH-?)?(\d{4})$/i);
  return m ? m[1] : s;
}

export function isValidSwissNpaFormat(npa: string): boolean {
  return /^[1-9]\d{3}$/.test(npa);
}

// ---------------------------------------------------------------------------
// Exonymes : nom d'usage dans une autre langue nationale / en anglais.
// Clé = cityKey de la saisie ; valeur = nom de commune du référentiel.
// Seules les villes où la confusion est plausible sont listées.
// ---------------------------------------------------------------------------
const EXONYMS: Record<string, string> = {
  genf: "Genève", geneva: "Genève", ginevra: "Genève", geneve: "Genève",
  berne: "Bern", berna: "Bern",
  bale: "Basel", basle: "Basel", basilea: "Basel",
  zurich: "Zürich", zurigo: "Zürich",
  lucerne: "Luzern", lucerna: "Luzern",
  bienne: "Biel/Bienne", biel: "Biel/Bienne",
  freiburg: "Fribourg", friburgo: "Fribourg",
  neuenburg: "Neuchâtel",
  sitten: "Sion", siders: "Sierre",
  soleure: "Solothurn", soletta: "Solothurn",
  "saint gall": "St. Gallen", "st gall": "St. Gallen", "san gallo": "St. Gallen", "sankt gallen": "St. Gallen",
  schaffhouse: "Schaffhausen", sciaffusa: "Schaffhausen",
  coire: "Chur", coira: "Chur",
  thoune: "Thun", morat: "Murten",
  delsberg: "Delémont", pruntrut: "Porrentruy",
  losanna: "Lausanne",
  yverdon: "Yverdon-les-Bains",
};

/** Exonymes indexés par cityKey (les clés ci-dessus sont écrites en clair). */
const EXONYM_BY_KEY = new Map(Object.entries(EXONYMS).map(([k, v]) => [cityKey(k), v]));

// ---------------------------------------------------------------------------
// Résolution ville × NPA
// ---------------------------------------------------------------------------

export type CityResolution =
  /** La saisie est déjà le nom officiel d'une commune du NPA. */
  | { kind: "exact"; commune: NpaCommune }
  /** Même commune, autre forme (casse, accents, trait d'union, article, exonyme, « Biel » pour « Biel/Bienne »). */
  | { kind: "variant"; commune: NpaCommune }
  /** La saisie est une localité / un quartier du NPA, pas une commune. */
  | { kind: "locality"; locality: string; communes: NpaCommune[] }
  /** Aucune correspondance dans ce NPA. `elsewhere` = communes de ce nom ailleurs en Suisse. */
  | { kind: "mismatch"; candidates: NpaCommune[]; elsewhere: NpaCommune[] }
  | { kind: "unknown_npa" }
  | { kind: "empty" };

function communeMatchesKey(c: NpaCommune, key: string): boolean {
  const k1 = cityKey(c.name);
  const k2 = cityKey(c.officialName);
  if (key === k1 || key === k2) return true;
  if (withoutArticle(key) === withoutArticle(k1)) return true;
  // « Biel/Bienne » : chaque partie du nom bilingue est acceptée.
  if (c.name.includes("/") && c.name.split("/").some((p) => cityKey(p) === key)) return true;
  const exo = EXONYM_BY_KEY.get(key);
  return exo !== undefined && cityKey(exo) === k1;
}

/** Résout une ville saisie par rapport à un NPA (déjà normalisé). */
export function resolveCity(index: NpaIndex, npa: string, rawCity: string): CityResolution {
  const city = normalizeCityInput(rawCity);
  if (!city) return { kind: "empty" };
  const communes = communesForNpa(index, npa);
  if (communes.length === 0) return { kind: "unknown_npa" };

  const exact = communes.find((c) => c.name === city);
  if (exact) return { kind: "exact", commune: exact };

  const key = cityKey(city);
  const variant = communes.find((c) => communeMatchesKey(c, key));
  if (variant) return { kind: "variant", commune: variant };

  // Localité postale (quartier, hameau) : « acacias » → « Les Acacias ».
  const locHits = communes.filter((c) =>
    c.localities.some((l) => {
      const lk = cityKey(l);
      return lk === key || withoutArticle(lk) === withoutArticle(key);
    }),
  );
  if (locHits.length > 0) {
    const locality =
      locHits[0].localities.find((l) => withoutArticle(cityKey(l)) === withoutArticle(key)) ?? city;
    return { kind: "locality", locality, communes: uniqueCommunes(locHits) };
  }

  const elsewhere = uniqueCommunes(findCommunesByName(index, city));
  return { kind: "mismatch", candidates: uniqueCommunes(communes), elsewhere };
}

/** Communes portant ce nom (ou cet exonyme), tous NPA confondus. */
export function findCommunesByName(index: NpaIndex, rawCity: string): NpaCommune[] {
  const key = cityKey(normalizeCityInput(rawCity));
  if (!key) return [];
  const exo = EXONYM_BY_KEY.get(key);
  const keys = new Set([key, withoutArticle(key), ...(exo ? [cityKey(exo)] : [])]);
  const out: NpaCommune[] = [];
  for (const k of keys) out.push(...(index.byCommuneKey.get(k) ?? []));
  return out;
}

// ---------------------------------------------------------------------------
// Validation à l'enregistrement (serveur) — même logique côté formulaire
// ---------------------------------------------------------------------------

export type LocationErrorCode =
  | "city_required_active"
  | "npa_required"
  | "npa_invalid"
  | "npa_unknown"
  | "city_is_locality"
  | "city_npa_mismatch";

export type LocationValidation =
  | {
      ok: true; city: string; postalCode: string; canton: string | null; changed: boolean;
      /**
       * Ville et NPA identiques aux valeurs en base : rien n'est normalisé ni
       * vérifié, l'appelant conserve ville / NPA / canton tels quels (aucun
       * slug /ville/… ne bouge tant que le thérapeute n'y touche pas).
       */
      unchanged?: boolean;
    }
  | { ok: false; code: LocationErrorCode; message: string; candidates: string[] };

function fail(code: LocationErrorCode, message: string, candidates: NpaCommune[] = []): LocationValidation {
  return { ok: false, code, message, candidates: uniqueCommunes(candidates).map((c) => c.name) };
}

/**
 * Règles :
 *  1. Fiche publiée (status 'active') : ville obligatoire.
 *  2. Ville renseignée ⇒ NPA suisse obligatoire (4 chiffres, connu du référentiel).
 *  3. Ville et NPA doivent concorder. Une variante de forme est corrigée vers le
 *     nom officiel ; une localité rattachée à une seule commune est remplacée par
 *     cette commune ; sinon refus avec la liste des communes possibles.
 *  4. NPA seul, ville vide : si le NPA ne couvre qu'une commune, elle est déduite.
 *  5. Le canton est déduit de la commune retenue (null si rien à déduire).
 *  6. Si `previous` est fourni et que ville ET NPA sont inchangés (après
 *     normalisation de forme), les règles 2–4 ne s'appliquent pas : une fiche
 *     existante non conforme n'est pas bloquée tant qu'on ne touche pas à sa
 *     localisation. La règle 1 (ville vide sur fiche publiée) s'applique toujours.
 */
export function validateTherapistLocation(
  index: NpaIndex,
  input: {
    city: string | null | undefined;
    postalCode: string | null | undefined;
    status?: string | null;
    previous?: { city: string | null | undefined; postalCode: string | null | undefined } | null;
  },
): LocationValidation {
  const rawCity = String(input.city ?? "");
  const city = normalizeCityInput(rawCity);
  const postalCode = normalizePostalCode(input.postalCode);
  const isActive = input.status === "active";

  if (
    input.previous &&
    city === normalizeCityInput(input.previous.city) &&
    postalCode === normalizePostalCode(input.previous.postalCode)
  ) {
    if (!city && isActive) {
      return fail("city_required_active", "Indiquez le NPA et la commune de votre cabinet : une fiche publiée doit indiquer sa ville.");
    }
    return {
      ok: true, unchanged: true, changed: false,
      city: String(input.previous.city ?? ""), postalCode: String(input.previous.postalCode ?? ""), canton: null,
    };
  }

  if (postalCode && !isValidSwissNpaFormat(postalCode)) {
    return fail("npa_invalid", "Le code postal (NPA) doit comporter 4 chiffres.");
  }
  if (postalCode && communesForNpa(index, postalCode).length === 0) {
    return fail("npa_unknown", `Le NPA ${postalCode} n'existe pas dans le répertoire officiel des localités suisses.`);
  }

  if (!city) {
    if (postalCode) {
      const communes = uniqueCommunes(communesForNpa(index, postalCode));
      if (communes.length === 1) {
        return { ok: true, city: communes[0].name, postalCode, canton: communes[0].canton, changed: true };
      }
      if (isActive) {
        return fail("city_required_active", "Choisissez la commune de votre cabinet : une fiche publiée doit indiquer sa ville.", communes);
      }
    } else if (isActive) {
      return fail("city_required_active", "Indiquez le NPA et la commune de votre cabinet : une fiche publiée doit indiquer sa ville.");
    }
    return { ok: true, city: "", postalCode, canton: null, changed: rawCity !== "" };
  }

  if (!postalCode) {
    return fail("npa_required", `Indiquez le code postal (NPA) de « ${city} » pour que la commune puisse être vérifiée.`);
  }

  const r = resolveCity(index, postalCode, city);
  switch (r.kind) {
    case "exact":
    case "variant":
      return {
        ok: true, city: r.commune.name, postalCode, canton: r.commune.canton,
        changed: r.commune.name !== rawCity,
      };
    case "locality":
      if (r.communes.length === 1) {
        return { ok: true, city: r.communes[0].name, postalCode, canton: r.communes[0].canton, changed: true };
      }
      return fail(
        "city_is_locality",
        `« ${r.locality} » est une localité du NPA ${postalCode}, pas une commune. Choisissez la commune : ${r.communes.map((c) => c.name).join(", ")}.`,
        r.communes,
      );
    case "mismatch":
      return fail(
        "city_npa_mismatch",
        `« ${city} » ne correspond pas au NPA ${postalCode}. Communes de ce NPA : ${r.candidates.map((c) => c.name).join(", ")}.`,
        r.candidates,
      );
    default:
      // unknown_npa / empty sont traités plus haut.
      return fail("npa_unknown", `Le NPA ${postalCode} n'existe pas dans le répertoire officiel des localités suisses.`);
  }
}
