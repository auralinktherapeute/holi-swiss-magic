/**
 * `lastmod` du sitemap pour les contenus éditoriaux : fiches thérapeutes,
 * articles (blog, fil) et « Voix d'experts ».
 *
 * Même colonne que « Mis à jour le … » et `dateModified` des pages
 * (CONTENT_DATE_COLUMN = content_updated_at, voir page-dates.ts) : le sitemap
 * ne doit pas annoncer une page comme modifiée parce qu'une traduction
 * automatique, une facture ou un backfill a touché `updated_at`.
 *
 * Jour calculé à l'heure de Zurich (`zurichDayOf`), comme la date affichée sur
 * la page : une modification à 23h30 UTC tombe le lendemain à Zurich.
 *
 * Les autres tables du sitemap (specialties, specialty_families, events) n'ont
 * pas de colonne content_updated_at : elles gardent leur `updated_at`.
 */
import { CONTENT_DATE_COLUMN, zurichDayOf } from "@/lib/page-dates";

type WithContentDate = { [K in typeof CONTENT_DATE_COLUMN]?: string | null };

const asDay = (raw: unknown): string | undefined => zurichDayOf(raw) ?? undefined;

/** Jour de dernière modification éditoriale d'une ligne, ou `undefined`. */
export function contentDay(row: WithContentDate | null | undefined): string | undefined {
  return asDay(row?.[CONTENT_DATE_COLUMN]);
}

/** Article : date éditoriale, sinon date de publication. */
export function articleLastmod(a: WithContentDate & { published_at?: string | null }): string | undefined {
  return contentDay(a) ?? asDay(a.published_at);
}

/** « Voix d'experts » : date éditoriale, sinon date de publication. */
export function paroleLastmod(a: WithContentDate & { date_publication?: string | null }): string | undefined {
  return contentDay(a) ?? asDay(a.date_publication);
}
