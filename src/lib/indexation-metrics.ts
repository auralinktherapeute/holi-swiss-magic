/**
 * Métriques d'indexation — module PUR (aucune I/O), partagé par la vue admin
 * et la vue thérapeute. Sources :
 *   - URL attendues : générateur de sitemap (`buildSitemapBlocks`), calculé côté serveur ;
 *   - suivi : tables `indexed_urls` / `indexing_reports` du projet dédié (lecture serveur).
 * Règle : une soumission IndexNow n'est JAMAIS une indexation ; seul l'état
 * constaté par Search Console (`status = indexed`) compte comme indexé.
 */

export const SITE_ORIGIN = "https://holiswiss.ch";
export const STALE_CHECK_DAYS = 30;
export const STALE_REPORT_HOURS = 48;

export type IndexedUrlRow = {
  id: string;
  url: string;
  lang: string | null;
  page_type: string;
  status: string;
  coverage_state: string | null;
  last_crawl_at: string | null;
  last_checked_at: string | null;
  priority: number;
  check_count: number;
  archived_at: string | null;
  archive_reason: string | null;
  last_submitted_at: string | null;
};

export type IndexingReportRow = {
  id: string;
  run_at: string;
  trigger: string;
  urls_total: number;
  urls_checked: number;
  newly_indexed: number;
  newly_discovered: number;
  not_indexed: number;
  blocked: number;
  errors: number;
  quota_used: number;
  summary_md: string | null;
};

/** Valeur mesurée, ou `null` = donnée indisponible (jamais un zéro inventé). */
export type Metric = number | null;

export type IndexationMetrics = {
  expected: Metric;
  expectedComputedAt: string | null;
  trackedActive: Metric;
  trackedArchived: Metric;
  missingFromTracking: Metric;
  trackedNotInSitemap: Metric;
  submittedIndexNow: Metric;
  lastSubmittedAt: string | null;
  indexed: Metric;
  crawledNotIndexed: Metric;
  discoveredNotIndexed: Metric;
  unknownToGoogle: Metric;
  errors: Metric;
  neverChecked: Metric;
  staleChecked: Metric;
  lastCheckedAt: string | null;
  lastReportAt: string | null;
};

export const ERROR_STATUSES = ["blocked_robots", "noindex", "canonical_other", "error"];

export function normalizeUrl(u: string): string {
  const s = u.trim();
  return s.length > SITE_ORIGIN.length + 1 && s.endsWith("/") ? s.slice(0, -1) : s;
}

const maxIso = (vals: (string | null)[]) =>
  vals.reduce<string | null>((m, v) => (v && (!m || v > m) ? v : m), null);

function isError(r: IndexedUrlRow) {
  return ERROR_STATUSES.includes(r.status) || /soft 404/i.test(r.coverage_state ?? "");
}
function isUnknown(r: IndexedUrlRow) {
  return /unknown to google/i.test(r.coverage_state ?? "");
}

export function computeIndexationMetrics(input: {
  urls: IndexedUrlRow[] | null;
  reports: IndexingReportRow[] | null;
  expectedUrls: string[] | null;
  expectedComputedAt: string | null;
  now: number;
}): IndexationMetrics {
  const { urls, reports, expectedUrls, now } = input;
  const active = urls ? urls.filter((u) => !u.archived_at) : null;
  const expectedSet = expectedUrls ? new Set(expectedUrls.map(normalizeUrl)) : null;
  const activeSet = active ? new Set(active.map((u) => normalizeUrl(u.url))) : null;
  const cnt = (f: (r: IndexedUrlRow) => boolean): Metric => (active ? active.filter(f).length : null);
  const staleLimit = now - STALE_CHECK_DAYS * 86400_000;

  return {
    expected: expectedSet ? expectedSet.size : null,
    expectedComputedAt: expectedSet ? input.expectedComputedAt : null,
    trackedActive: active ? active.length : null,
    trackedArchived: urls && active ? urls.length - active.length : null,
    missingFromTracking:
      expectedSet && activeSet ? [...expectedSet].filter((u) => !activeSet.has(u)).length : null,
    trackedNotInSitemap:
      expectedSet && activeSet ? [...activeSet].filter((u) => !expectedSet.has(u)).length : null,
    submittedIndexNow: cnt((r) => !!r.last_submitted_at),
    lastSubmittedAt: active ? maxIso(active.map((r) => r.last_submitted_at)) : null,
    indexed: cnt((r) => r.status === "indexed"),
    crawledNotIndexed: cnt((r) => r.status === "crawled_not_indexed"),
    discoveredNotIndexed: cnt((r) => r.status === "discovered_not_crawled"),
    unknownToGoogle: cnt((r) => !isError(r) && r.status !== "indexed" && isUnknown(r)),
    errors: cnt(isError),
    neverChecked: cnt((r) => !r.last_checked_at),
    staleChecked: cnt((r) => !!r.last_checked_at && new Date(r.last_checked_at).getTime() < staleLimit),
    lastCheckedAt: urls ? maxIso(urls.map((r) => r.last_checked_at)) : null,
    lastReportAt: reports && reports.length ? maxIso(reports.map((r) => r.run_at)) : null,
  };
}

export function indexationWarnings(input: {
  m: IndexationMetrics;
  reports: IndexingReportRow[] | null;
  trackingError: string | null;
  sitemapError: string | null;
  now: number;
}): string[] {
  const w: string[] = [];
  const { m, reports, now } = input;
  if (input.trackingError) w.push("Suivi d'indexation inaccessible : données Search Console indisponibles.");
  if (input.sitemapError) w.push("Plan du site non calculable : nombre d'URL attendu indisponible.");
  if (m.lastReportAt && now - new Date(m.lastReportAt).getTime() > STALE_REPORT_HOURS * 3600_000) {
    w.push(`Dernier rapport ancien (plus de ${STALE_REPORT_HOURS} h) : les chiffres peuvent être périmés.`);
  }
  const lastCron = (reports ?? []).find((r) => r.trigger === "cron");
  if (lastCron?.summary_md && /sitemap suspect/i.test(lastCron.summary_md)) {
    w.push(
      "La version actuellement déployée de l'outil d'indexation ne lit pas les 7 parties du plan du site : nouvelles URL non ajoutées, URL retirées non archivées.",
    );
  }
  if ((m.missingFromTracking ?? 0) > 0 || (m.trackedNotInSitemap ?? 0) > 0) {
    w.push("Écart entre le plan du site actuel et le suivi : le suivi n'est pas à jour.");
  }
  return w;
}

/* ─────────── Vue thérapeute : sa propre page uniquement ─────────── */

export type MyPageState =
  | "indexed"
  | "crawled_not_indexed"
  | "discovered_not_indexed"
  | "unknown_to_google"
  | "problem"
  | "not_published"
  | "not_tracked"
  | "unavailable"
  | "pending";

export type MyPageIndexStatus = {
  state: MyPageState;
  label: string;
  explanation: string;
  lastCheckedAt: string | null;
  stale: boolean;
};

const MY_PAGE_COPY: Record<MyPageState, { label: string; explanation: string }> = {
  indexed: { label: "Indexée par Google", explanation: "Search Console a constaté que votre page est dans l'index Google." },
  crawled_not_indexed: { label: "Explorée, non indexée", explanation: "Google a visité votre page mais ne l'a pas encore ajoutée à son index." },
  discovered_not_indexed: { label: "Découverte, pas encore explorée", explanation: "Google connaît l'adresse de votre page mais ne l'a pas encore visitée." },
  unknown_to_google: { label: "Pas encore connue de Google", explanation: "Search Console ne connaît pas encore cette adresse." },
  problem: { label: "Problème signalé", explanation: "Search Console signale un obstacle sur cette page ; l'équipe Holiswiss en est informée par son suivi." },
  pending: { label: "Contrôle en attente", explanation: "Votre page est suivie mais son état Google n'a pas encore été constaté." },
  not_published: { label: "Donnée indisponible", explanation: "Votre fiche n'est pas publiée : aucun état Google ne peut être mesuré." },
  not_tracked: { label: "État inconnu", explanation: "Votre page n'est pas encore dans le suivi Search Console." },
  unavailable: { label: "Donnée indisponible", explanation: "Le suivi Search Console est momentanément inaccessible." },
};

export function myPageUrl(slug: string): string {
  return `${SITE_ORIGIN}/fr/therapeute/${encodeURIComponent(slug)}`;
}

export function buildMyPageStatus(input: {
  published: boolean;
  row: Pick<IndexedUrlRow, "status" | "coverage_state" | "last_checked_at"> | null;
  fetchFailed: boolean;
  now: number;
}): MyPageIndexStatus {
  const make = (state: MyPageState, lastCheckedAt: string | null = null): MyPageIndexStatus => ({
    state,
    ...MY_PAGE_COPY[state],
    lastCheckedAt,
    stale: !!lastCheckedAt && input.now - new Date(lastCheckedAt).getTime() > STALE_CHECK_DAYS * 86400_000,
  });
  if (!input.published) return make("not_published");
  if (input.fetchFailed) return make("unavailable");
  const r = input.row;
  if (!r) return make("not_tracked");
  if (!r.last_checked_at) return make("pending");
  const at = r.last_checked_at;
  if (ERROR_STATUSES.includes(r.status) || /soft 404/i.test(r.coverage_state ?? "")) return make("problem", at);
  if (r.status === "indexed") return make("indexed", at);
  if (r.status === "crawled_not_indexed") return make("crawled_not_indexed", at);
  if (r.status === "discovered_not_crawled") return make("discovered_not_indexed", at);
  if (/unknown to google/i.test(r.coverage_state ?? "")) return make("unknown_to_google", at);
  return make("pending", at);
}
