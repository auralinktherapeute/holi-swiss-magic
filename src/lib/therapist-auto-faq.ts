/**
 * FAQ « pratique » d'une fiche thérapeute, construite UNIQUEMENT à partir des
 * données de la fiche (Levier 2 du Baromètre GEO).
 *
 * Règles (ne pas assouplir sans relire `.agents/product-marketing.md`) :
 * - une donnée absente (null, vide, prix ≤ 0, devise autre que CHF) supprime la
 *   question : aucune valeur par défaut, rien d'inventé ;
 * - aucun pronom genré : chaque question et réponse nomme la personne en toutes
 *   lettres (le genre n'est renseigné nulle part en base) ;
 * - réponses purement descriptives, présentées comme des informations indiquées
 *   par le praticien — jamais de promesse d'effet, jamais « vérifié » ;
 * - les certifications ne sont citées que si leur justificatif a réellement été
 *   examiné (`verification_status = 'verified'`, non expirées), avec la formule
 *   « justificatif examiné par Holiswiss ».
 *
 * Module pur : aucune dépendance à React ni à Supabase. Le texte est calculé une
 * seule fois dans le loader (serveur au premier rendu) et transmis tel quel au
 * HTML visible et au JSON-LD FAQPage, qui sont donc identiques par construction
 * et ne peuvent pas diverger à l'hydratation.
 */

export type AutoFaqItem = { question: string; answer: string };

/** Traduction liée à la langue de la page (ex. `i18n.getFixedT(lang)`). */
export type AutoFaqTranslate = (key: string, vars?: Record<string, unknown>) => string;

export type AutoFaqTherapist = {
  first_name?: string | null;
  last_name?: string | null;
  specialties?: unknown;
  approaches?: unknown;
  price_min?: number | string | null;
  price_max?: number | string | null;
  currency?: string | null;
  consultation_modes?: unknown;
  languages?: unknown;
  city?: string | null;
  canton?: string | null;
};

export type AutoFaqCertification = {
  name?: string | null;
  issuer?: string | null;
  verification_status?: string | null;
  expires_at?: string | null;
};

/** En dessous, ni section ni FAQPage : une « FAQ » d'une seule question
 * répète le bandeau de la fiche sans rien apporter au lecteur. */
export const AUTO_FAQ_MIN = 2;
/** Au-delà, la section devient un second profil : on s'arrête à quatre. */
export const AUTO_FAQ_MAX = 4;
/** Nombre de certifications citées nommément avant « et N autres ». */
export const AUTO_FAQ_CERTS_LISTED = 5;

const NS = "therapist_auto_faq";

const MODE_ORDER = ["in_person", "online", "home"] as const;
type Mode = (typeof MODE_ORDER)[number];

/** Codes et libellés rencontrés en base → code de langue. */
const LANGUAGE_ALIASES: Record<string, "fr" | "de" | "it" | "en"> = {
  fr: "fr", francais: "fr", french: "fr", franzosisch: "fr", francese: "fr",
  de: "de", deutsch: "de", allemand: "de", german: "de", tedesco: "de",
  it: "it", italiano: "it", italien: "it", italian: "it", italienisch: "it",
  en: "en", english: "en", anglais: "en", englisch: "en", inglese: "en",
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    const v = clean(raw);
    if (!v) continue;
    const k = v.toLocaleLowerCase("fr");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Montant CHF formaté à la main (pas de `toLocaleString`) : les données ICU du
 * serveur et du navigateur peuvent différer, un espace insécable de trop suffit
 * à casser l'hydratation. Séparateur de milliers suisse « ’ ».
 */
export function formatChfPlain(amount: number): string {
  const fixed = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  const [int, dec] = fixed.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return `CHF ${dec ? `${grouped}.${dec}` : grouped}`;
}

/** Jointure « a, b et c » écrite à la main (même raison que ci-dessus). */
function joinList(items: string[], t: AutoFaqTranslate): string {
  if (items.length <= 1) return items.join("");
  const and = t(`${NS}.list_and`);
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

/**
 * Certifications dont le justificatif a été examiné et qui ne sont pas
 * expirées — le même filtre que `hasCredential` dans le JSON-LD de la fiche.
 */
export function examinedCertifications<T extends AutoFaqCertification>(
  certs: readonly T[] | null | undefined,
  now: number,
): T[] {
  return (certs ?? []).filter(
    (c) =>
      c?.verification_status === "verified" &&
      clean(c.name).length > 0 &&
      (!c.expires_at || Date.parse(c.expires_at) >= now),
  );
}

function placeLabel(th: AutoFaqTherapist, t: AutoFaqTranslate): string {
  const city = clean(th.city);
  const canton = clean(th.canton);
  if (city && canton) return `${city} (${canton})`;
  if (city) return city;
  if (canton) return t(`${NS}.place_canton_only`, { canton });
  return "";
}

function specialtiesItem(name: string, th: AutoFaqTherapist, t: AutoFaqTranslate): AutoFaqItem | null {
  // `approaches` existe en base mais n'est rempli sur aucune fiche aujourd'hui ;
  // fusionné aux spécialités (dédoublonnées) s'il l'est un jour.
  const list = cleanList([...cleanList(th.specialties), ...cleanList(th.approaches)]);
  if (list.length === 0) return null;
  return {
    question: t(`${NS}.q_specialties`, { name }),
    answer: t(`${NS}.a_specialties`, { name, list: list.join(", ") }),
  };
}

function priceItem(name: string, th: AutoFaqTherapist, t: AutoFaqTranslate): AutoFaqItem | null {
  if (clean(th.currency).toUpperCase() !== "CHF") return null;
  const min = toNumber(th.price_min);
  if (min == null || min <= 0) return null;
  const max = toNumber(th.price_max);
  const question = t(`${NS}.q_price`, { name });
  if (max != null && max > min) {
    return {
      question,
      answer: t(`${NS}.a_price_range`, { name, min: formatChfPlain(min), max: formatChfPlain(max) }),
    };
  }
  if (max != null && max === min) {
    return { question, answer: t(`${NS}.a_price_exact`, { name, min: formatChfPlain(min) }) };
  }
  return { question, answer: t(`${NS}.a_price_from`, { name, min: formatChfPlain(min) }) };
}

function locationItem(name: string, th: AutoFaqTherapist, t: AutoFaqTranslate): AutoFaqItem | null {
  const raw = Array.isArray(th.consultation_modes) ? th.consultation_modes : [];
  const modes = MODE_ORDER.filter((m: Mode) => raw.includes(m));
  const place = placeLabel(th, t);

  if (modes.length === 0) {
    if (!place) return null;
    return {
      question: t(`${NS}.q_location`, { name }),
      answer: t(`${NS}.a_place_only`, { name, place }),
    };
  }

  const labels = modes.map((m) => t(`${NS}.mode_${m}`));
  let answer = t(`${NS}.a_modes`, { name, modes: joinList(labels, t) });
  // La localité est toujours donnée dans une phrase à part : aucune préposition
  // devant un nom de lieu libre (« à Le Grand Saconnex », « a acacias »).
  if (place) answer = `${answer} ${t(`${NS}.a_place_suffix`, { place })}`;
  return { question: t(`${NS}.q_location_modes`, { name }), answer };
}

function languagesItem(name: string, th: AutoFaqTherapist, t: AutoFaqTranslate): AutoFaqItem | null {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const raw of cleanList(th.languages)) {
    const key = raw
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    const code = Object.hasOwn(LANGUAGE_ALIASES, key) ? LANGUAGE_ALIASES[key] : undefined;
    // Langue inconnue du dictionnaire : gardée telle que saisie, jamais écartée.
    const label = code ? t(`${NS}.language_${code}`) : raw;
    const dedupe = code ?? key;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    labels.push(label);
  }
  if (labels.length === 0) return null;
  return {
    question: t(`${NS}.q_languages`, { name }),
    answer: t(`${NS}.a_languages`, { name, list: labels.join(", ") }),
  };
}

function certificationsItem(
  name: string,
  certs: readonly AutoFaqCertification[],
  t: AutoFaqTranslate,
): AutoFaqItem | null {
  if (certs.length === 0) return null;
  const shown = certs.slice(0, AUTO_FAQ_CERTS_LISTED).map((c) => {
    const n = clean(c.name);
    // « Organisme · » saisi avec un séparateur orphelin : on retire la ponctuation finale.
    const issuer = clean(c.issuer).replace(/[\s·•,;:–-]+$/u, "");
    return issuer ? `${n} (${issuer})` : n;
  });
  let list = shown.join(" ; ");
  const rest = certs.length - shown.length;
  if (rest > 0) list = `${list} ${t(`${NS}.certs_more`, { count: rest })}`;
  return {
    question: t(`${NS}.q_certs`, { name }),
    answer: t(`${NS}.a_certs`, { count: certs.length, list }),
  };
}

/**
 * Questions retenues, dans l'ordre de priorité, plafonnées à AUTO_FAQ_MAX.
 * Renvoie un tableau VIDE si moins de AUTO_FAQ_MIN questions sont fondées.
 */
export function buildTherapistAutoFaq(
  therapist: AutoFaqTherapist | null | undefined,
  certifications: readonly AutoFaqCertification[] | null | undefined,
  t: AutoFaqTranslate,
  options: { now?: number } = {},
): AutoFaqItem[] {
  if (!therapist) return [];
  const name = [clean(therapist.first_name), clean(therapist.last_name)].filter(Boolean).join(" ");
  if (!name) return [];

  const certs = examinedCertifications(certifications, options.now ?? Date.now());
  const items = [
    specialtiesItem(name, therapist, t),
    priceItem(name, therapist, t),
    locationItem(name, therapist, t),
    // Certifications avant les langues : signal le plus différenciant, alors
    // que les langues figurent déjà dans le bandeau de la fiche.
    certificationsItem(name, certs, t),
    languagesItem(name, therapist, t),
  ].filter((x): x is AutoFaqItem => x !== null);

  if (items.length < AUTO_FAQ_MIN) return [];
  return items.slice(0, AUTO_FAQ_MAX);
}
