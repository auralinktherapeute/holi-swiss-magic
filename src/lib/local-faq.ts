/**
 * FAQ « locale » des pages d'annuaire ville / canton / spécialité, construite
 * UNIQUEMENT à partir des fiches que la page liste (Levier 5 du Baromètre GEO).
 *
 * Règles (ne pas assouplir sans relire `.agents/product-marketing.md`) :
 * - les lignes reçues sont EXACTEMENT celles de la liste affichée et du bloc de
 *   chiffres (`ListingFactsBlock`) : la FAQ ne peut pas contredire la page ;
 * - une donnée absente supprime la question — aucune valeur par défaut ;
 * - moins de LOCAL_FAQ_MIN questions fondées → tableau vide (ni section, ni
 *   FAQPage) ; liste vide → tableau vide ;
 * - réponses descriptives, présentées comme des informations indiquées sur les
 *   fiches : jamais d'effet, jamais « vérifié », aucun superlatif ;
 * - le nom de lieu (texte libre saisi par les praticiens : « Le Grand
 *   Saconnex », « acacias »…) n'est JAMAIS précédé d'une préposition : il est
 *   posé en apposition (« Lausanne : … ») ou après « est » (« dont la localité
 *   indiquée est Lausanne »). Leçon de la PR #15 (« à Le Grand-Saconnex »).
 *
 * Module pur : aucune dépendance à React ni à Supabase. Le texte est calculé une
 * seule fois dans le loader et transmis tel quel au HTML visible et au JSON-LD
 * FAQPage — identiques par construction, aucun écart d'hydratation possible.
 */

import {
  computeListingFacts,
  countProfileLanguages,
  formatChfAmount,
  validChfPriceMin,
  type FactsRow,
} from "@/lib/directory-stats";

export type LocalFaqItem = { question: string; answer: string };

/** Traduction liée à la langue de la page (ex. `i18n.getFixedT(lang)`). */
export type LocalFaqTranslate = (key: string, vars?: Record<string, unknown>) => string;

export type LocalFaqKind = "city" | "canton" | "specialty";

export type LocalFaqRow = FactsRow & {
  id?: string | null;
  price_max?: number | string | null;
  consultation_modes?: unknown;
};

/** Rattachement d'une fiche à une spécialité ACTIVE du référentiel (`therapist_specialties`). */
export type SpecialtyLink = {
  therapist_id: string;
  slug: string;
  name_fr?: string | null;
  name_de?: string | null;
  name_it?: string | null;
  name_en?: string | null;
};

export type LocalFaqInput = {
  kind: LocalFaqKind;
  /** Libellé du lieu ou de la spécialité, dans la langue de la page. */
  place: string;
  /** Langue de la page, pour les noms du référentiel. */
  lang: string;
  /**
   * Rattachements au référentiel pour les pages ville / canton. `null` =
   * pivot illisible : la question est omise plutôt que fausse.
   */
  specialtyLinks?: ReadonlyArray<SpecialtyLink> | null;
};

export const LOCAL_FAQ_MIN = 2;
export const LOCAL_FAQ_MAX = 4;
/** Spécialités citées nommément avant « et N autres ». */
export const LOCAL_FAQ_SPECIALTIES_LISTED = 6;

const NS = "local_faq";
/** Libellés partagés avec la FAQ de fiche (modes, langues, « et »). */
const SHARED = "therapist_auto_faq";

const MODE_ORDER = ["in_person", "online", "home"] as const;

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Jointure « a, b et c » écrite à la main (pas d'Intl.ListFormat : identique serveur/client). */
export function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}

function pickName(link: SpecialtyLink, lang: string): string {
  const l = lang.slice(0, 2);
  const localized = clean((link as Record<string, unknown>)[`name_${l}`]);
  return localized || clean(link.name_fr) || "";
}

/**
 * Spécialités du référentiel rattachées aux fiches listées : une fiche compte
 * une fois par spécialité, les rattachements de fiches hors liste sont ignorés.
 * Tri : nombre de fiches décroissant, puis `slug` (comparaison par unité de
 * code, identique serveur/client). Départager par le slug et non par le nom
 * traduit : les 6 spécialités citées sont les mêmes dans les quatre langues.
 *
 * Les noms viennent du référentiel TELS QUELS (ex. « Geistiges Heilen », intitulé
 * de discipline ASCA/EMR) — non filtrés ici. Leur conformité relève du
 * référentiel `specialties`, pas de ce module (décision laissée à Gérald).
 */
export function tallySpecialties(
  rows: ReadonlyArray<LocalFaqRow>,
  links: ReadonlyArray<SpecialtyLink>,
  lang: string,
): Array<{ name: string; count: number }> {
  const listed = new Set(rows.map((r) => r.id).filter((x): x is string => !!x));
  const bySlug = new Map<string, { slug: string; name: string; ids: Set<string> }>();
  for (const l of links) {
    if (!listed.has(l.therapist_id) || !l.slug) continue;
    const name = pickName(l, lang);
    if (!name) continue;
    const entry = bySlug.get(l.slug) ?? { slug: l.slug, name, ids: new Set<string>() };
    entry.ids.add(l.therapist_id);
    bySlug.set(l.slug, entry);
  }
  return [...bySlug.values()]
    .sort((a, b) => b.ids.size - a.ids.size || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((e) => ({ name: e.name, count: e.ids.size }));
}

// Pas de date dans les réponses : le bloc de chiffres la porte déjà, et le
// FAQPage ne doit pas changer chaque jour quand les fiches, elles, ne changent pas.
function countItem(rows: ReadonlyArray<LocalFaqRow>, input: LocalFaqInput, t: LocalFaqTranslate): LocalFaqItem {
  const { kind, place } = input;
  return {
    question: t(`${NS}.q_count_${kind}`, { place }),
    answer: t(`${NS}.a_count_${kind}`, { count: rows.length, place }),
  };
}

function specialtiesItem(
  rows: ReadonlyArray<LocalFaqRow>,
  input: LocalFaqInput,
  t: LocalFaqTranslate,
): LocalFaqItem | null {
  if (input.kind === "specialty" || !input.specialtyLinks) return null;
  const tally = tallySpecialties(rows, input.specialtyLinks, input.lang);
  if (tally.length === 0) return null;
  const shown = tally.slice(0, LOCAL_FAQ_SPECIALTIES_LISTED).map((s) => `${s.name} (${s.count})`);
  const rest = tally.length - shown.length;
  const list =
    rest > 0
      ? `${shown.join(", ")} ${t(`${NS}.more`, { count: rest })}`
      : joinList(shown, t(`${SHARED}.list_and`));
  return {
    question: t(`${NS}.q_specialties`, { place: input.place }),
    answer: t(`${NS}.a_specialties`, { list }),
  };
}

function validChfPriceMax(row: LocalFaqRow, min: number): number | null {
  const raw = row.price_max;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  // Un maximum inférieur au minimum est une saisie incohérente : ignoré.
  if (!Number.isFinite(n) || n <= 0 || n < min) return null;
  return n;
}

function priceItem(rows: ReadonlyArray<LocalFaqRow>, input: LocalFaqInput, t: LocalFaqTranslate): LocalFaqItem | null {
  // Borne basse, fiches tarifées : même calcul que le bloc de chiffres
  // (`computeListingFacts`) — le « dès CHF X » affiché plus haut et la FAQ
  // ne peuvent pas diverger.
  const facts = computeListingFacts(rows);
  if (facts.priceFrom === null || facts.pricedCount === 0) return null;
  let upper = facts.priceFrom;
  for (const r of rows) {
    const min = validChfPriceMin(r);
    if (min === null) continue;
    const max = validChfPriceMax(r, min);
    upper = Math.max(upper, max ?? min);
  }
  const vars = {
    count: facts.pricedCount,
    total: rows.length,
    min: formatChfAmount(facts.priceFrom),
    max: formatChfAmount(upper),
  };
  return {
    question: t(`${NS}.q_price`, { place: input.place }),
    answer:
      upper > facts.priceFrom ? t(`${NS}.a_price_range`, vars) : t(`${NS}.a_price_single`, vars),
  };
}

function modesItem(rows: ReadonlyArray<LocalFaqRow>, input: LocalFaqInput, t: LocalFaqTranslate): LocalFaqItem | null {
  const counts = new Map<string, number>();
  let withModes = 0;
  for (const r of rows) {
    const raw = Array.isArray(r.consultation_modes) ? r.consultation_modes : [];
    const modes = MODE_ORDER.filter((m) => raw.includes(m));
    if (modes.length === 0) continue;
    withModes += 1;
    for (const m of modes) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  if (withModes === 0) return null;
  const total = rows.length;
  const parts = MODE_ORDER.filter((m) => (counts.get(m) ?? 0) > 0).map((m) =>
    t(`${NS}.share`, { label: t(`${SHARED}.mode_${m}`), count: counts.get(m), total }),
  );
  let answer = t(`${NS}.a_modes`, { list: joinList(parts, t(`${SHARED}.list_and`)) });
  const missing = total - withModes;
  if (missing > 0) answer = `${answer} ${t(`${NS}.a_modes_missing`, { count: missing })}`;
  return { question: t(`${NS}.q_modes`, { place: input.place }), answer };
}

function languagesItem(rows: ReadonlyArray<LocalFaqRow>, input: LocalFaqInput, t: LocalFaqTranslate): LocalFaqItem | null {
  // Mêmes valeurs reconnues que le bloc de chiffres de l'accueil.
  const langs = countProfileLanguages(rows);
  if (langs.length === 0) return null;
  const total = rows.length;
  const parts = langs.map((l) =>
    t(`${NS}.share`, { label: t(`${SHARED}.language_${l.code}`), count: l.count, total }),
  );
  return {
    question: t(`${NS}.q_languages`, { place: input.place }),
    answer: t(`${NS}.a_languages`, { list: joinList(parts, t(`${SHARED}.list_and`)) }),
  };
}

/**
 * Questions retenues, dans l'ordre de priorité, plafonnées à LOCAL_FAQ_MAX.
 * Renvoie un tableau VIDE si la liste est vide, si le libellé manque, ou si
 * moins de LOCAL_FAQ_MIN questions sont fondées. La décision d'indexabilité
 * (seuils de `seo-thresholds.ts`) reste au loader : il n'appelle pas ce module
 * pour une page noindex.
 */
export function buildLocalFaq(
  rows: ReadonlyArray<LocalFaqRow> | null | undefined,
  input: LocalFaqInput,
  t: LocalFaqTranslate,
): LocalFaqItem[] {
  const list = rows ?? [];
  const place = clean(input.place);
  if (list.length === 0 || !place) return [];
  const scoped = { ...input, place };

  const items = [
    countItem(list, scoped, t),
    specialtiesItem(list, scoped, t),
    priceItem(list, scoped, t),
    modesItem(list, scoped, t),
    languagesItem(list, scoped, t),
  ].filter((x): x is LocalFaqItem => x !== null);

  // Le décompte seul ne fait pas une FAQ : il répète le titre de la liste.
  if (items.length < LOCAL_FAQ_MIN) return [];
  return items.slice(0, LOCAL_FAQ_MAX);
}

export type LocalFaqSection = { title: string; subtitle: string; items: LocalFaqItem[] };

/**
 * Section complète (titre h2, sous-titre, questions) calculée dans le loader :
 * le composant n'appelle aucune traduction, le HTML serveur et le client
 * rendent la même chaîne. `null` quand la FAQ n'a pas lieu d'être.
 */
export function buildLocalFaqSection(
  rows: ReadonlyArray<LocalFaqRow> | null | undefined,
  input: LocalFaqInput,
  t: LocalFaqTranslate,
): LocalFaqSection | null {
  const items = buildLocalFaq(rows, input, t);
  if (items.length === 0) return null;
  const place = clean(input.place);
  return {
    title: t(`${NS}.title`, { place }),
    subtitle: t(`${NS}.subtitle`),
    items,
  };
}

/**
 * Nœud JSON-LD FAQPage — un seul par page, `@id` `${url}#faq`, rattaché à la
 * CollectionPage de la page. Texte repris tel quel des items affichés.
 */
export function localFaqJsonLd(
  items: ReadonlyArray<LocalFaqItem>,
  opts: { url: string; lang: string; pageId: string },
): Record<string, unknown> | null {
  if (items.length < LOCAL_FAQ_MIN) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${opts.url}#faq`,
    inLanguage: opts.lang,
    isPartOf: { "@id": opts.pageId },
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}
