/**
 * Accès SERVEUR au suivi d'indexation hébergé sur le projet dédié (lecture seule).
 * Ce fichier `.server.ts` n'entre jamais dans le bundle navigateur : la clé
 * publique du projet dédié n'est plus servie au client. Aucune écriture ici.
 */
import type { IndexedUrlRow, IndexingReportRow } from "@/lib/indexation-metrics";

export const AGENTS_URL = "https://gpldaaqwvwopttachrma.supabase.co";
// Clé publique (rôle anon) du projet dédié — déjà publique côté RLS, gardée côté serveur.
export const AGENTS_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwbGRhYXF3dndvcHR0YWNocm1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODIyOTAsImV4cCI6MjA5NjU1ODI5MH0.BKuw_l2YrTZXTDHFlMcTC0yoH003_naKeoJXYs61fQg";

export const agentsHeaders = () => ({
  apikey: AGENTS_ANON,
  Authorization: `Bearer ${AGENTS_ANON}`,
  "Content-Type": "application/json",
});

const URL_COLUMNS =
  "id,url,lang,page_type,status,coverage_state,last_crawl_at,last_checked_at,priority,check_count,archived_at,archive_reason,last_submitted_at";

async function getJson<T>(path: string, fetcher: typeof fetch): Promise<T> {
  const res = await fetcher(`${AGENTS_URL}/rest/v1/${path}`, { headers: agentsHeaders() });
  if (!res.ok) throw new Error(`Suivi d'indexation HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function fetchTrackedUrls(fetcher: typeof fetch = fetch) {
  return getJson<IndexedUrlRow[]>(
    `indexed_urls?select=${URL_COLUMNS}&order=priority.asc,last_submitted_at.asc.nullsfirst,url.asc&limit=3000`,
    fetcher,
  );
}

export function fetchReports(fetcher: typeof fetch = fetch) {
  return getJson<IndexingReportRow[]>(
    "indexing_reports?select=id,run_at,trigger,urls_total,urls_checked,newly_indexed,newly_discovered,not_indexed,blocked,errors,quota_used,summary_md&order=run_at.desc&limit=20",
    fetcher,
  );
}

/** Une seule URL, colonnes minimales — pour la vue thérapeute. */
export async function fetchOneUrlStatus(url: string, fetcher: typeof fetch = fetch) {
  const rows = await getJson<Pick<IndexedUrlRow, "status" | "coverage_state" | "last_checked_at">[]>(
    `indexed_urls?select=status,coverage_state,last_checked_at&url=eq.${encodeURIComponent(url)}&limit=1`,
    fetcher,
  );
  return rows[0] ?? null;
}

/** Appel de la RPC existante, inchangée (protégée par PIN côté projet dédié). */
export async function callRecheckRpc(urlId: string, pin: string, fetcher: typeof fetch = fetch) {
  const r = await fetcher(`${AGENTS_URL}/rest/v1/rpc/request_url_recheck`, {
    method: "POST",
    headers: agentsHeaders(),
    body: JSON.stringify({ p_url_id: urlId, p_pin: pin }),
  });
  if (!r.ok) return false;
  return ((await r.json()) as boolean) === true;
}
