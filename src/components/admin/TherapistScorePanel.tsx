/**
 * Synthèse « Score du thérapeute » pour l'administration.
 * Réutilise le rapport unique `buildShowcaseReport` (même moteur que le
 * tableau de bord thérapeute) : aucun calcul parallèle ici.
 * Données strictement individuelles — jamais exposées côté public.
 */
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, ExternalLink, History } from "lucide-react";
import { getTherapistShowcaseReport } from "@/lib/therapist-health.functions";
import { SHOWCASE_STATUS_LABEL } from "@/lib/showcase-actions";
import { AUDIT_CATEGORY_LABEL } from "@/lib/showcase-audit";

const SOURCE_LABEL: Record<string, string> = {
  elite_pro: "Formule Elite Pro",
  early_adopter: "Parmi les 70 premiers inscrits",
  founding_70: "Accès fondateur (70 premiers)",
  manual_grant: "Activation manuelle",
  admin_manual: "Activation manuelle",
  commercial_offer: "Offre commerciale",
  offer_accepted: "Offre acceptée",
};

function fmt(v: string | null | undefined) {
  return v ? new Date(v).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
      <div className={`text-sm font-semibold ${tone ?? "text-white"}`}>{value}</div>
      <div className="text-[11px] text-white/50">{label}</div>
    </div>
  );
}

export default function TherapistScorePanel({ therapistId, slug }: { therapistId: string; slug?: string | null }) {
  const fetchReport = useServerFn(getTherapistShowcaseReport);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [showChecks, setShowChecks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(
    async (persist: boolean) => {
      persist ? setRerunning(true) : setLoading(true);
      try {
        setReport(await fetchReport({ data: { therapistId, persist } }));
        if (persist) toast.success("Analyse relancée.");
      } catch (e: any) {
        toast.error(e?.message ?? "Analyse indisponible");
      } finally {
        persist ? setRerunning(false) : setLoading(false);
      }
    },
    [fetchReport, therapistId],
  );

  useEffect(() => {
    setReport(null);
    setShowChecks(false);
    setShowHistory(false);
    load(false);
  }, [load]);

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">
        <Loader2 className="animate-spin" size={14} /> Chargement du score…
      </div>
    );
  }
  if (!report) return null;

  const a = report.access ?? {};
  const delta: number | null = report.delta;
  const status = SHOWCASE_STATUS_LABEL[report.status];

  return (
    <section className="mt-4 rounded-lg border border-cyan-400/25 bg-cyan-400/[0.06] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/90">Score du thérapeute</h3>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => load(true)}
            disabled={rerunning}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/85 hover:bg-white/5 disabled:opacity-60"
          >
            {rerunning ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />} Relancer l'analyse
          </button>
          <button
            type="button"
            onClick={() => setShowChecks((v) => !v)}
            aria-expanded={showChecks}
            className="min-h-[36px] rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/5"
          >
            {showChecks ? "Masquer les critères" : "Voir les critères détaillés"}
          </button>
          {slug && (
            <a
              href={`/fr/therapeute/${slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-cyan-200 hover:bg-white/5"
            >
              Audit public <ExternalLink size={11} aria-hidden />
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label={`Score global — ${status?.label ?? "—"}`} value={`${report.score}/100`} />
        <Stat label={`Score de base (${report.basic.completed}/${report.basic.total})`} value={`${report.basic.score}/100`} />
        <Stat label="Score avancé (visibilité)" value={report.totals ? `${report.totals.visibilite}/100` : "—"} />
        <Stat label="Score de conversion" value={report.totals ? `${report.totals.conversion}/100` : "—"} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Éligibilité"
          value={a.advanced ? "Éligible (avancé)" : "Non éligible (base)"}
          tone={a.advanced ? "text-green-400" : "text-white/60"}
        />
        <Stat
          label="Source de l'accès"
          value={a.sources?.length ? a.sources.map((s: string) => SOURCE_LABEL[s] ?? s).join(" · ") : "—"}
        />
        <Stat
          label="Place fondateur"
          value={a.seatNumber ? `n°${a.seatNumber} / ${a.earlySlots}${a.seatStatus === "revoked" ? " (retirée)" : ""}` : "aucune"}
        />
        <Stat label="Dernière analyse" value={fmt(report.analyzedAt)} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat
          label="Recommandations ouvertes"
          value={report.openCount}
          tone={report.openCount === 0 ? "text-green-400" : "text-amber-300"}
        />
        <Stat label="Points résolus" value={report.resolvedCount} />
        <Stat
          label={`Progression${report.previousAt ? ` (depuis le ${fmt(report.previousAt)})` : ""}`}
          value={delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta} pts`}
          tone={delta == null ? "text-white/60" : delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/60"}
        />
      </div>

      {Array.isArray(report.categories) && (
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {report.categories.map((cat: any) => (
            <li key={cat.id} className="flex items-center justify-between gap-2 rounded-md bg-white/5 px-2 py-1 text-[11px]">
              <span className="text-white/70">{cat.label}</span>
              <span className="font-semibold text-white">
                {cat.score}/100 <span className="text-white/40">({cat.passed}/{cat.total})</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showChecks && (
        <ul className="mt-3 space-y-1">
          {report.checks.map((c: any) => (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              {c.passed ? (
                <CheckCircle2 className="mt-0.5 shrink-0 text-green-400" size={13} aria-hidden />
              ) : (
                <AlertTriangle
                  className={`mt-0.5 shrink-0 ${c.severity === "critical" ? "text-red-400" : c.severity === "warning" ? "text-amber-400" : "text-cyan-300"}`}
                  size={13}
                  aria-hidden
                />
              )}
              <span className={c.passed ? "text-white/50" : "text-white/85"}>
                <span className="sr-only">{c.passed ? "Conforme :" : "À corriger :"} </span>
                {c.label} <span className="text-white/40">· {(AUDIT_CATEGORY_LABEL as any)[c.category] ?? c.category} · +{c.gain} pts</span>
                {!c.passed && <span className="block text-white/45">{c.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        aria-expanded={showHistory}
        className="mt-2 inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-xs text-white/70 hover:bg-white/5"
      >
        <History size={13} aria-hidden /> Historique des analyses ({report.snapshots?.length ?? 0})
      </button>
      {showHistory && (
        <ul className="mt-2 space-y-1 text-[11px] text-white/65">
          {(report.snapshots ?? []).length === 0 && <li className="text-white/40">Aucune analyse enregistrée.</li>}
          {(report.snapshots ?? []).map((s: any, i: number) => (
            <li key={`${s.created_at}-${i}`} className="rounded border border-white/10 px-2 py-1">
              {new Date(s.created_at).toLocaleString("fr-CH")} — {s.score}/100 · visibilité {s.score_visibilite ?? "—"} ·
              conversion {s.score_conversion ?? "—"}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
