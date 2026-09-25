/**
 * Chiffres publics de l'annuaire (Levier 1 du Baromètre GEO).
 *
 * Règles non négociables :
 *  - TOUT chiffre affiché est calculé à la requête à partir des lignes déjà
 *    lues par la page (ou par `getDirectoryStats` pour l'accueil). Aucun chiffre
 *    n'est écrit en dur, ni ici, ni dans les traductions.
 *  - Les lignes passées ici sont EXACTEMENT celles que la page liste : le
 *    chiffre et la liste visibles ne peuvent pas diverger.
 *  - `verifiedCount` n'est affiché que s'il est > 0 (le composant s'en charge).
 *
 * Module pur : aucun accès réseau, aucun JSX — partagé client et serveur.
 */

import { cityToSlug } from "@/lib/city-slug";

export type FactsRow = {
  verified?: boolean | null;
  price_min?: number | string | null;
  currency?: string | null;
  canton?: string | null;
  city?: string | null;
  languages?: string[] | null;
};

export type ListingFacts = {
  /** Nombre de fiches listées sur la page. */
  count: number;
  /** Fiches marquées `verified = true` — affiché uniquement si > 0. */
  verifiedCount: number;
  /** Plus petit `price_min` valide (> 0, en CHF), ou null s'il n'y en a aucun. */
  priceFrom: number | null;
  /** Nombre de fiches portant un `price_min` valide. */
  pricedCount: number;
  /** Cantons distincts non vides. */
  cantonCount: number;
  /** Villes distinctes, regroupées comme les pages ville (`cityToSlug`). */
  cityCount: number;
};

/** Valeurs réellement stockées dans `therapists.languages` (vérifié sur qqwud). */
export const KNOWN_PROFILE_LANGUAGES = {
  Français: "fr",
  Deutsch: "de",
  Italiano: "it",
  English: "en",
} as const;

export type ProfileLanguageCode =
  (typeof KNOWN_PROFILE_LANGUAGES)[keyof typeof KNOWN_PROFILE_LANGUAGES];

export type DirectoryFacts = ListingFacts & {
  /**
   * Spécialités du référentiel (`specialties`, actives) rattachées à au moins
   * une fiche listée via `therapist_specialties` — c'est-à-dire le nombre de
   * pages spécialité qui ont quelqu'un à montrer. Jamais calculé depuis le
   * texte libre `therapists.specialties`. `null` si le pivot n'a pas pu être
   * lu : on n'affiche alors aucun compte plutôt qu'un zéro faux.
   */
  specialtyCount: number | null;
  /** Nombre de fiches par langue parlée (seules les 4 valeurs connues). */
  languages: Array<{ code: ProfileLanguageCode; count: number }>;
  /** Jour du calcul, fuseau Europe/Zurich, format AAAA-MM-JJ. */
  asOf: string;
};

function validPrice(row: FactsRow): number | null {
  const cur = (row.currency ?? "CHF").trim().toUpperCase();
  if (cur && cur !== "CHF") return null;
  const raw = row.price_min;
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

// Même clé que l'URL `/ville/{slug}` : « Genève » et « Geneve » sont une seule
// ville, comme il n'existe qu'une seule page pour les deux.
function normCity(city: string | null | undefined): string {
  return cityToSlug(city ?? "");
}

export function computeListingFacts(rows: ReadonlyArray<FactsRow>): ListingFacts {
  let verifiedCount = 0;
  let priceFrom: number | null = null;
  let pricedCount = 0;
  const cantons = new Set<string>();
  const cities = new Set<string>();

  for (const r of rows) {
    if (r.verified === true) verifiedCount += 1;
    const p = validPrice(r);
    if (p !== null) {
      pricedCount += 1;
      if (priceFrom === null || p < priceFrom) priceFrom = p;
    }
    const canton = (r.canton ?? "").trim().toUpperCase();
    if (canton) cantons.add(canton);
    const city = normCity(r.city);
    if (city) cities.add(city);
  }

  return {
    count: rows.length,
    verifiedCount,
    priceFrom,
    pricedCount,
    cantonCount: cantons.size,
    cityCount: cities.size,
  };
}

export function countProfileLanguages(
  rows: ReadonlyArray<FactsRow>,
): Array<{ code: ProfileLanguageCode; count: number }> {
  const order: ProfileLanguageCode[] = ["fr", "de", "it", "en"];
  const counts = new Map<ProfileLanguageCode, number>();
  for (const r of rows) {
    const seen = new Set<ProfileLanguageCode>();
    for (const value of r.languages ?? []) {
      const code = (KNOWN_PROFILE_LANGUAGES as Record<string, ProfileLanguageCode>)[
        (value ?? "").trim()
      ];
      if (code) seen.add(code);
    }
    for (const code of seen) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return order
    .filter((code) => (counts.get(code) ?? 0) > 0)
    .map((code) => ({ code, count: counts.get(code)! }))
    .sort((a, b) => b.count - a.count || order.indexOf(a.code) - order.indexOf(b.code));
}

/** Jour courant à Zurich, `AAAA-MM-JJ`. À appeler côté serveur (au moment de la lecture). */
export function zurichDay(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * `AAAA-MM-JJ` → `JJ.MM.AAAA` (usage suisse dans les quatre langues).
 * Formatage manuel, sans Intl : identique au serveur et au navigateur, donc
 * aucun risque d'écart d'hydratation.
 */
export function formatSwissDate(isoDay: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}

/** `90` → `CHF 90`, `1250` → `CHF 1’250`, `92.5` → `CHF 92.50` (usage suisse). */
export function formatChfAmount(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int, dec] = rounded.toFixed(2).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "’");
  return dec === "00" ? `CHF ${grouped}` : `CHF ${grouped}.${dec}`;
}
