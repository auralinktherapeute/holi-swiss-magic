import { AlertTriangle } from "lucide-react";
import type { IndexationMetrics, Metric } from "@/lib/indexation-metrics";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" }) : "date inconnue";

function Cell({ label, value, source, date }: { label: string; value: Metric; source: string; date: string | null }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">
        {value == null ? <span className="text-sm font-medium text-muted-foreground">Donnée indisponible</span> : value}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {source} · {fmtDate(date)}
      </div>
    </div>
  );
}

/** Métriques datées, avec leur source. `null` s'affiche « Donnée indisponible ». */
export function IndexationMetricsPanel({
  metrics,
  warnings,
  loading,
  error,
}: {
  metrics: IndexationMetrics | null;
  warnings: string[];
  loading: boolean;
  error: string | null;
}) {
  if (loading && !metrics) return <p className="text-sm text-muted-foreground">Chargement des métriques…</p>;
  if (!metrics) {
    return (
      <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm">
        Donnée indisponible : le tableau n'a pas pu être chargé{error ? ` (${error})` : ""}. Aucun chiffre n'est affiché
        plutôt qu'un chiffre faux.
      </div>
    );
  }
  const m = metrics;
  const sc = "Search Console";
  const tr = "Suivi d'indexation";
  return (
    <section aria-label="Métriques d'indexation" className="space-y-3">
      {warnings.length > 0 && (
        <ul role="status" className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
          {warnings.map((w) => (
            <li key={w} className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {w}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cell label="URL attendues (plan du site actuel)" value={m.expected} source="Plan du site" date={m.expectedComputedAt} />
        <Cell label="Suivies actives" value={m.trackedActive} source={tr} date={m.lastCheckedAt} />
        <Cell label="Archivées" value={m.trackedArchived} source={tr} date={m.lastCheckedAt} />
        <Cell label="Attendues mais non suivies" value={m.missingFromTracking} source="Plan du site vs suivi" date={m.expectedComputedAt} />
        <Cell label="Suivies hors plan du site" value={m.trackedNotInSitemap} source="Plan du site vs suivi" date={m.expectedComputedAt} />
        <Cell label="Soumises IndexNow (≠ indexées)" value={m.submittedIndexNow} source="IndexNow" date={m.lastSubmittedAt} />
        <Cell label="Indexées (constat Google)" value={m.indexed} source={sc} date={m.lastCheckedAt} />
        <Cell label="Explorées, non indexées" value={m.crawledNotIndexed} source={sc} date={m.lastCheckedAt} />
        <Cell label="Découvertes, non indexées" value={m.discoveredNotIndexed} source={sc} date={m.lastCheckedAt} />
        <Cell label="Inconnues de Google" value={m.unknownToGoogle} source={sc} date={m.lastCheckedAt} />
        <Cell label="Erreurs / soft 404" value={m.errors} source={sc} date={m.lastCheckedAt} />
        <Cell label="Jamais contrôlées ou contrôle > 30 j" value={m.neverChecked == null || m.staleChecked == null ? null : m.neverChecked + m.staleChecked} source={sc} date={m.lastCheckedAt} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Dernier rapport : {fmtDate(m.lastReportAt)}. Une soumission IndexNow acceptée (HTTP 200/202) ne confirme jamais
        l'indexation : seul Search Console la constate.
      </p>
    </section>
  );
}
