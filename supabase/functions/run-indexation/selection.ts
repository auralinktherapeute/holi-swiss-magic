/**
 * Logique PURE du suivi d'indexation — sélection des URLs à inspecter et
 * rédaction de l'état du rapport. Aucun accès réseau ici : ce module est
 * importable tel quel par les tests (`src/lib/indexation-selection.test.ts`)
 * comme par l'edge function Deno.
 *
 * POURQUOI CE FICHIER EXISTE (constat du 21/09/2026)
 *   La sélection d'inspection était `order=priority.asc,last_checked_at.asc.nullsfirst`
 *   avec `limit=85`. La priorité primant sur l'ancienneté, les 85 places étaient
 *   saturées à chaque run par les P1/P2 (fiches, accueil, listings) —
 *   fraîchement contrôlés la veille et recontrôlés le lendemain. Résultat :
 *   223 URLs (essentiellement des articles P4) JAMAIS inspectées depuis
 *   juillet/août, alors que Search Console en déclare 425 « détectées, non
 *   indexées ». Le suivi ne mentait pas, il ne regardait jamais.
 *
 *   La règle qui remplace ça : d'abord les jamais-vues, puis le contrôle le plus
 *   ancien. La priorité ne sert plus qu'à départager, l'`id` à rendre l'ordre
 *   stable (deux URLs contrôlées à la même seconde ne s'échangent pas leur place
 *   d'un run à l'autre).
 */

export type InspectionCandidate = {
  id: string;
  url: string;
  status: string;
  priority?: number | null;
  last_checked_at?: string | null;
};

function cmpPriorityThenId(a: InspectionCandidate, b: InspectionCandidate): number {
  const pa = a.priority ?? 99;
  const pb = b.priority ?? 99;
  if (pa !== pb) return pa - pb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Ordre équitable : jamais inspectées d'abord, puis contrôle le plus ancien.
 * Priorité en départage seulement, `id` pour la stabilité.
 */
export function orderInspectionCandidates<T extends InspectionCandidate>(
  rows: readonly T[],
  limit: number,
): T[] {
  const never = rows.filter((r) => !r.last_checked_at).sort(cmpPriorityThenId);
  const seen = rows
    .filter((r) => !!r.last_checked_at)
    .sort((a, b) => {
      const ta = a.last_checked_at as string;
      const tb = b.last_checked_at as string;
      if (ta !== tb) return ta < tb ? -1 : 1;
      return cmpPriorityThenId(a, b);
    });
  return [...never, ...seen].slice(0, Math.max(0, limit));
}

/** Nombre d'URLs dont le dernier contrôle est plus vieux que `days` jours (ou jamais). */
export function countStale(
  rows: readonly InspectionCandidate[],
  days: number,
  nowMs = Date.now(),
): number {
  const cutoff = new Date(nowMs - days * 86400_000).toISOString();
  return rows.filter((r) => !r.last_checked_at || r.last_checked_at < cutoff).length;
}

/**
 * `null` = compte INDISPONIBLE (lecture en échec). Jamais 0 : un faux zéro dans
 * un rapport de suivi se lit comme une bonne nouvelle.
 */
export type TrackingState = {
  /** URLs actives (non archivées) — le périmètre suivi, PAS un compte de non-indexées. */
  active: number | null;
  /** URLs actives CONTRÔLÉES dont l'état constaté n'est pas `indexed`. */
  notIndexed: number | null;
  /** URLs actives jamais inspectées par Search Console. */
  neverInspected: number | null;
  /** URLs actives dont le dernier contrôle dépasse `staleDays`. */
  staleChecks: number | null;
  staleDays: number;
  /** Total suivi, archivées comprises. */
  total: number | null;
  /** Inspections réellement effectuées ce run, et échecs d'appel API. */
  inspected: number;
  inspectFailures: number;
  indexNowSubmitted: number;
  indexNowStatus: number;
};

/**
 * Bloc « État » du rapport. Il doit rendre impossibles les trois confusions qui
 * ont fait lire le suivi de travers : actives ≠ non indexées, un contrôle vieux
 * de deux mois ≠ un constat, et un HTTP 200 d'IndexNow ≠ une indexation Google.
 */
export function buildStateSection(s: TrackingState): string {
  return [
    `${s.active} URLs actives suivies (périmètre du suivi, ce n'est PAS un nombre de pages non indexées).`,
    `Dont non indexées au dernier constat : ${s.notIndexed}.`,
    `Jamais inspectées par Search Console : ${s.neverInspected}.`,
    `Contrôle plus ancien que ${s.staleDays} j (ou jamais) : ${s.staleChecks} — fraîcheur du suivi.`,
    `${s.total} URLs suivies au total, archivées comprises.`,
    `Inspections ce run : ${s.inspected}${s.inspectFailures > 0 ? ` · ${s.inspectFailures} appel(s) Search Console en échec (aucun état n'a été dégradé pour autant)` : ""}.`,
    `IndexNow : ${s.indexNowSubmitted} URLs → HTTP ${s.indexNowStatus}. Une soumission acceptée n'est pas une indexation : seul Search Console constate l'indexation Google.`,
  ].join("\n");
}
