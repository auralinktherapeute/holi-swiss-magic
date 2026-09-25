/**
 * Dates de mise à jour des pages publiques (Levier 3 du Baromètre GEO).
 *
 * Règles non négociables :
 *  - La date vient TOUJOURS d'une colonne réelle de la base de production
 *    (`updated_at` d'une fiche ou d'un article ; pour une page liste, le plus
 *    récent parmi les fiches AFFICHÉES par la page). Jamais la date du jour,
 *    jamais une valeur par défaut : sans date valide, on n'affiche rien et on
 *    n'émet pas de `dateModified`.
 *  - Aucune dépendance à l'ICU ni à l'horloge : le jour civil est calculé à la
 *    main dans le fuseau Europe/Zurich (règle d'heure d'été européenne), à
 *    partir de l'instant stocké. Serveur et navigateur obtiennent donc
 *    exactement la même chaîne — aucun écart d'hydratation possible.
 *  - Le texte visible et le JSON-LD décrivent le MÊME instant : le JSON-LD
 *    reçoit l'horodatage de la base réexprimé avec le décalage de Zurich
 *    (`+01:00` / `+02:00`), dont la partie date est le jour affiché.
 *
 * Module pur : aucun accès réseau, aucun JSX — partagé client et serveur.
 */

/**
 * Colonne qui fait foi pour « Mis à jour le » et `dateModified`, sur
 * `therapists`, `articles` et `therapist_articles`.
 *
 * `content_updated_at` (migration 20260925150000, appliquée en prod le
 * 26/09/2026, vérifiée : 200 en anon sur therapists, articles et
 * therapist_articles, reprise conforme, aucune valeur au 25/09). Elle n'avance
 * que sur une modification éditoriale (fiche : bio, short_bio, title,
 * specialties, approaches, services, tarifs ; article : title_fr, excerpt_fr,
 * body_fr ; article de thérapeute : contenu). Ne JAMAIS revenir à `updated_at`,
 * remis à now() par tout UPDATE (traductions automatiques, factures,
 * newsletter, backfills…).
 *
 * Lectures qui dépendent de cette constante :
 *  - src/lib/geo-listings.functions.ts : PUBLIC_COLUMNS (canton, ville, annuaire)
 *    et le select de getDirectoryStats (accueil) ;
 *  - src/lib/specialties.functions.ts : select des fiches de getSpecialtyPage ;
 *  - src/lib/public.functions.ts : select principal de getTherapistBySlug (fiche) ;
 *  - src/lib/fil.functions.ts : LIST_COLUMNS et `toPost` (fil) ;
 *  - routes blog / paroles : lisent `article[CONTENT_DATE_COLUMN]` sur un
 *    `select("*")` (getArticleBySlug, getPublishedTherapistArticleBySlug) —
 *    rien à changer dans les requêtes.
 * Hors constante (à revoir lors de la bascule) : la requête client de
 * revalidation de la fiche (`$lang.therapeute.$slug.tsx`, useQuery) ne lit pas
 * la date — la date vient du loader ; le sitemap (`sitemap[.]xml.ts`) a ses
 * propres `lastmod` sur `updated_at`.
 */
export const CONTENT_DATE_COLUMN = "content_updated_at" as const;
export type ContentDateColumn = typeof CONTENT_DATE_COLUMN;

export type PageDateLang = "fr" | "de" | "it" | "en";

export function asPageDateLang(lang: string | null | undefined): PageDateLang {
  const l = (lang ?? "").slice(0, 2).toLowerCase();
  return l === "de" || l === "it" || l === "en" ? l : "fr";
}

type ParsedInstant = {
  /** Millisecondes depuis l'époque Unix (UTC). */
  epochMs: number;
  /** Fraction de seconde telle qu'écrite en base (ex. `.775415`), ou "". */
  fraction: string;
  /** Microsecondes au-delà de la milliseconde, pour départager deux instants. */
  subMs: number;
};

// PostgREST renvoie `2026-09-25T14:35:42.775415+00:00`. On accepte aussi `Z`,
// un espace à la place du `T`, un décalage `+0200` ou `+02`. Sans décalage
// (colonne `timestamp` sans fuseau), la valeur est lue comme UTC — c'est le
// fuseau des sessions Supabase.
const TIMESTAMP_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** Horodatage de la base → instant, ou `null` s'il est absent ou illisible. */
export function parseDbTimestamp(raw: unknown): ParsedInstant | null {
  if (typeof raw !== "string") return null;
  const m = TIMESTAMP_RE.exec(raw.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac = "", tz = "Z"] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;

  let offsetMinutes = 0;
  if (tz !== "Z") {
    const sign = tz.startsWith("-") ? -1 : 1;
    const digits = tz.slice(1).replace(":", "");
    const oh = Number(digits.slice(0, 2));
    const om = digits.length > 2 ? Number(digits.slice(2, 4)) : 0;
    if (oh > 14 || om > 59) return null;
    offsetMinutes = sign * (oh * 60 + om);
  }

  const fracDigits = frac.slice(1);
  const micro = fracDigits ? Number((fracDigits + "000000").slice(0, 6)) : 0;
  const ms = Math.floor(micro / 1000);
  const epochMs =
    Date.UTC(year, month - 1, day, hour, minute, second, ms) - offsetMinutes * 60_000;
  return { epochMs, fraction: frac, subMs: micro % 1000 };
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/** Jour de la semaine (0 = dimanche) d'une date civile — Sakamoto, sans Date. */
function weekday(year: number, month: number, day: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = month < 3 ? year - 1 : year;
  return (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + t[month - 1] + day) % 7;
}

function lastSunday(year: number, month: number): number {
  const last = daysInMonth(year, month);
  return last - weekday(year, month, last);
}

/**
 * Décalage de Zurich (minutes) à un instant donné : +60 en hiver, +120 en été.
 * Règle européenne (en vigueur en Suisse depuis 1996) : heure d'été du dernier
 * dimanche de mars à 01:00 UTC au dernier dimanche d'octobre à 01:00 UTC.
 */
export function zurichOffsetMinutes(epochMs: number): 60 | 120 {
  const year = new Date(epochMs).getUTCFullYear();
  const start = Date.UTC(year, 2, lastSunday(year, 3), 1, 0, 0);
  const end = Date.UTC(year, 9, lastSunday(year, 10), 1, 0, 0);
  return epochMs >= start && epochMs < end ? 120 : 60;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function zurichParts(p: ParsedInstant) {
  const offset = zurichOffsetMinutes(p.epochMs);
  const local = new Date(p.epochMs + offset * 60_000);
  return {
    offset,
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds(),
  };
}

/** Jour civil à Zurich (`AAAA-MM-JJ`) d'un horodatage de la base, ou `null`. */
export function zurichDayOf(raw: unknown): string | null {
  const p = parseDbTimestamp(raw);
  if (!p) return null;
  const z = zurichParts(p);
  return `${z.year}-${pad2(z.month)}-${pad2(z.day)}`;
}

/**
 * Horodatage de la base réexprimé à l'heure de Zurich, ISO 8601 complet :
 * `2026-09-25T14:35:42.775415+00:00` → `2026-09-25T16:35:42.775415+02:00`.
 * Même instant, fraction de seconde conservée telle qu'écrite en base ; la
 * partie date est le jour affiché sur la page.
 */
export function toZurichIso(raw: unknown): string | null {
  const p = parseDbTimestamp(raw);
  if (!p) return null;
  const z = zurichParts(p);
  const sign = "+";
  const oh = pad2(Math.floor(z.offset / 60));
  const om = pad2(z.offset % 60);
  return (
    `${z.year}-${pad2(z.month)}-${pad2(z.day)}T${pad2(z.hour)}:${pad2(z.minute)}:${pad2(z.second)}` +
    `${p.fraction}${sign}${oh}:${om}`
  );
}

/**
 * Le plus récent des horodatages fournis, renvoyé TEL QU'ÉCRIT en base (chaîne
 * brute), ou `null` si aucun n'est lisible. Les valeurs nulles ou illisibles
 * sont ignorées — jamais remplacées par une date par défaut.
 */
export function latestTimestamp(values: ReadonlyArray<unknown>): string | null {
  let best: { raw: string; p: ParsedInstant } | null = null;
  for (const v of values) {
    const p = parseDbTimestamp(v);
    if (!p) continue;
    if (
      !best ||
      p.epochMs > best.p.epochMs ||
      (p.epochMs === best.p.epochMs && p.subMs > best.p.subMs)
    ) {
      best = { raw: (v as string).trim(), p };
    }
  }
  return best ? best.raw : null;
}

/** Instant `a` strictement antérieur à `b` (tous deux lisibles), sinon false. */
function isBefore(a: unknown, b: unknown): boolean {
  const pa = parseDbTimestamp(a);
  const pb = parseDbTimestamp(b);
  if (!pa || !pb) return false;
  return pa.epochMs < pb.epochMs || (pa.epochMs === pb.epochMs && pa.subMs < pb.subMs);
}

export type PageModified = {
  /** Valeur brute de la base (sert de clé de comparaison et de preuve). */
  raw: string;
  /** Pour le JSON-LD : ISO 8601 complet, décalage de Zurich. */
  iso: string;
  /** Jour affiché, `AAAA-MM-JJ` (Zurich) — aussi l'attribut `datetime`. */
  day: string;
};

/** Horodatage brut → les trois formes utilisées par une page, ou `null`. */
export function pageModified(raw: unknown): PageModified | null {
  const iso = toZurichIso(raw);
  const day = zurichDayOf(raw);
  if (!iso || !day) return null;
  return { raw: String(raw).trim(), iso, day };
}

/**
 * Page liste : date = la plus récente des fiches affichées (vide → `null`).
 * `key` : colonne de date lue sur chaque ligne (par défaut CONTENT_DATE_COLUMN).
 */
export function listModified(
  rows: ReadonlyArray<object | null | undefined>,
  key: string = CONTENT_DATE_COLUMN,
): PageModified | null {
  return pageModified(
    latestTimestamp(rows.map((r) => (r ? (r as Record<string, unknown>)[key] ?? null : null))),
  );
}

/**
 * Article : `datePublished` = date de publication réelle ; `dateModified` =
 * `updated_at`, sauf s'il est ANTÉRIEUR à la publication (donnée incohérente :
 * Google signale un `dateModified` avant `datePublished`) — on n'émet alors
 * rien plutôt qu'une date fausse. Aucun repli de l'un sur l'autre.
 */
export function articleDates(
  publishedAt: unknown,
  updatedAt: unknown,
): { published: PageModified | null; modified: PageModified | null } {
  const published = pageModified(publishedAt);
  let modified = pageModified(updatedAt);
  if (modified && published && isBefore(updatedAt, publishedAt)) modified = null;
  return { published, modified };
}

/**
 * Article : faut-il afficher « Mis à jour le » en plus de la date de
 * publication ? Non si c'est le même jour à Zurich (la date visible est déjà
 * celle du `dateModified`) — évite « 15 septembre 2026 · Mis à jour le
 * 15 septembre 2026 ». Le JSON-LD, lui, garde son `dateModified`.
 */
export function visibleArticleUpdate(dates: {
  published: PageModified | null;
  modified: PageModified | null;
}): PageModified | null {
  const { published, modified } = dates;
  if (!modified) return null;
  return published && published.day === modified.day ? null : modified;
}

/** Jour de publication d'un article, formaté comme « Mis à jour le » (Zurich, sans Intl). */
export function formatPublishedDate(raw: unknown, lang: string): string {
  return formatLongDate(zurichDayOf(raw), lang);
}

const MONTHS: Record<PageDateLang, readonly string[]> = {
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/**
 * `AAAA-MM-JJ` → date longue localisée, formatage manuel (pas d'Intl) :
 * fr « 1er octobre 2026 », de « 1. Oktober 2026 », it « 1º ottobre 2026 »,
 * en « 1 October 2026 ». Chaîne vide si le jour est illisible.
 */
export function formatLongDate(isoDay: string | null | undefined, lang: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay ?? "");
  if (!m) return "";
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  const l = asPageDateLang(lang);
  const name = MONTHS[l][month - 1];
  switch (l) {
    case "fr":
      return `${day === 1 ? "1er" : day} ${name} ${m[1]}`;
    case "de":
      return `${day}. ${name} ${m[1]}`;
    case "it":
      return `${day === 1 ? "1º" : day} ${name} ${m[1]}`;
    default:
      return `${day} ${name} ${m[1]}`;
  }
}

const UPDATED_LABEL: Record<PageDateLang, (date: string) => string> = {
  fr: (d) => `Mis à jour le ${d}`,
  de: (d) => `Aktualisiert am ${d}`,
  it: (d) => `Aggiornato il ${d}`,
  en: (d) => `Updated ${d}`,
};

/** « Mis à jour le 25 septembre 2026 » (4 langues), ou "" sans jour valide. */
export function formatUpdatedLabel(isoDay: string | null | undefined, lang: string): string {
  const date = formatLongDate(isoDay, lang);
  return date ? UPDATED_LABEL[asPageDateLang(lang)](date) : "";
}
