import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HeartPulse, RefreshCw, Loader2, ExternalLink, CheckCircle2, AlertTriangle, Sparkles, PenLine, Mail, Radar, ArrowUp, ArrowDown, Minus, FileText } from "lucide-react";
import {
  listHealthScores,
  getHealthDetail,
  updateRecommendationStatus,
  runHealthScan,
  regenerateArticleIdea,
  queueSuggestedArticle,
  sendProfileHealthInvite,
  sendProfileHealthRecap,
  runCitabilityScan,
  auditTherapistShowcase,
  getTherapistScoringAccess,
  setTherapistScoringAccess,
  listScoringAccessEvents,
  listFounderSeats,
  setFounderSeat,
  setFounderSeatDisplay,
} from "@/lib/therapist-health.functions";
import TherapistScorePanel from "@/components/admin/TherapistScorePanel";

export const Route = createFileRoute("/admin/sante-profils")({ component: Page });

const COLOR: Record<string, string> = { green: "#22c55e", orange: "#f59e0b", red: "#ef4444" };
const CAT_LABEL: Record<string, string> = {
  completude: "Complétude",
  contenu: "Contenu",
  activite: "Activité",
  visibilite: "Visibilité",
};
const CAT_MAX: Record<string, number> = { completude: 35, contenu: 25, activite: 20, visibilite: 20 };
const SEV_ICON: Record<string, string> = { critical: "🔴", warning: "🟠", info: "🔵" };

const SEAT_SOURCE_LABEL: Record<string, string> = {
  auto_activation: "Activation automatique",
  admin_manual: "Activation manuelle",
  commercial_offer: "Offre commerciale",
  offer_accepted: "Offre acceptée",
  backfill: "Reprise historique",
};
const SEAT_ACTION_LABEL: Record<string, string> = {
  granted: "Attribution",
  revoked: "Retrait",
  restored: "Rétablissement",
};

function fmtDate(v: string | null) {
  return v ? new Date(v).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
}

/** Places fondateur : 70 numéros d'ordre immuables, historique et réglage d'affichage. */
function FounderSeatsPanel() {
  const load = useServerFn(listFounderSeats);
  const toggleDisplay = useServerFn(setFounderSeatDisplay);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    load()
      .then(setData)
      .catch((e: any) => toast.error(e?.message ?? "Chargement impossible"))
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => { refresh(); }, [refresh]);

  const onToggleDisplay = async (show: boolean) => {
    try {
      await toggleDisplay({ data: { show } });
      setData((d: any) => (d ? { ...d, showSeatNumber: show } : d));
      toast.success(show ? "Numéro de place affiché aux thérapeutes" : "Numéro de place masqué");
    } catch (e: any) {
      toast.error(e?.message ?? "Modification impossible");
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-[rgba(168,85,247,.25)] bg-[#2d1b4e]/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[#d9b4ff]" size={18} aria-hidden="true" />
          <h2 className="text-base font-semibold">Places fondateur — scoring avancé</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={data?.showSeatNumber ?? true}
              onChange={(e) => onToggleDisplay(e.target.checked)}
              className="h-4 w-4 accent-[#8b5cf6]"
            />
            Afficher le numéro au thérapeute
          </label>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/80 hover:bg-white/5 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={13} /> : <RefreshCw size={13} />} Actualiser
          </button>
        </div>
      </div>

      {data && (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
              <div className="text-lg font-semibold">{data.used}</div>
              <div className="text-[11px] text-white/50">Places utilisées</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
              <div className="text-lg font-semibold text-green-400">{data.remaining}</div>
              <div className="text-[11px] text-white/50">Places restantes</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2">
              <div className="text-lg font-semibold">{data.active}/{data.total}</div>
              <div className="text-[11px] text-white/50">Accès actifs</div>
            </div>
          </div>

          <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-white/10">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#1a0a2e] text-white/60">
                <tr>
                  <th scope="col" className="px-2 py-1.5">N°</th>
                  <th scope="col" className="px-2 py-1.5">Thérapeute</th>
                  <th scope="col" className="px-2 py-1.5">Activation</th>
                  <th scope="col" className="px-2 py-1.5">Source</th>
                  <th scope="col" className="px-2 py-1.5">Statut</th>
                </tr>
              </thead>
              <tbody>
                {data.seats.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-3 text-white/50">Aucune place attribuée pour l’instant.</td></tr>
                )}
                {data.seats.map((s: any) => (
                  <tr key={s.seat_number} className="border-t border-white/5">
                    <td className="px-2 py-1.5 font-semibold text-white/80">{s.seat_number}</td>
                    <td className="px-2 py-1.5">
                      {s.therapist ? `${s.therapist.first_name ?? ""} ${s.therapist.last_name ?? ""}`.trim() : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-white/60">{fmtDate(s.granted_at)}</td>
                    <td className="px-2 py-1.5 text-white/60">{SEAT_SOURCE_LABEL[s.source] ?? s.source}</td>
                    <td className="px-2 py-1.5">
                      <span className={s.status === "active" ? "text-green-400" : "text-white/40"}>
                        {s.status === "active" ? "Actif" : "Retiré"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="mt-2 min-h-[36px] text-xs text-white/60 underline underline-offset-2 hover:text-white/85"
          >
            {showHistory ? "Masquer l’historique" : `Historique des modifications (${data.events.length})`}
          </button>
          {showHistory && (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-[11px] text-white/60">
              {data.events.map((e: any) => (
                <li key={e.id} className="rounded border border-white/10 px-2 py-1">
                  {fmtDate(e.created_at)} — {SEAT_ACTION_LABEL[e.action] ?? e.action} n°{e.seat_number ?? "—"} ·{" "}
                  {e.therapist ? `${e.therapist.first_name ?? ""} ${e.therapist.last_name ?? ""}`.trim() : "—"}
                  {e.source ? ` · ${SEAT_SOURCE_LABEL[e.source] ?? e.source}` : ""}
                </li>
              ))}
              {data.events.length === 0 && <li className="text-white/40">Aucune modification enregistrée.</li>}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

type Row = {
  therapist_id: string;
  name: string;
  canton: string;
  slug: string;
  score: number;
  score_previous: number | null;
  last_recap_sent_at: string | null;
  created_at: string | null;
  grade: string;
  breakdown: Record<string, number>;
};

type SortMode = "score_asc" | "score_desc" | "trend_desc" | "recent" | "name";

function TrendBadge({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null) return <span className="inline-flex items-center gap-0.5 text-white/30"><Minus size={11} /></span>;
  const diff = current - previous;
  if (diff === 0) return <span className="inline-flex items-center gap-0.5 text-white/40 text-[11px]"><Minus size={11} /></span>;
  if (diff > 0)
    return <span className="inline-flex items-center gap-0.5 text-green-400 text-[11px] font-semibold"><ArrowUp size={11} />+{diff}</span>;
  return <span className="inline-flex items-center gap-0.5 text-red-400 text-[11px] font-semibold"><ArrowDown size={11} />{diff}</span>;
}

function Gauge({ value, grade }: { value: number; grade: string }) {
  const c = COLOR[grade] ?? "#ef4444";
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ffffff22" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9" fill="none" stroke={c} strokeWidth="3"
          strokeDasharray={`${value} ${100 - value}`} strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-lg font-bold text-white">{value}</span>
    </div>
  );
}

function Page() {
  const fetchList = useServerFn(listHealthScores);
  const fetchDetail = useServerFn(getHealthDetail);
  const setRecoStatus = useServerFn(updateRecommendationStatus);
  const scan = useServerFn(runHealthScan);
  const citability = useServerFn(runCitabilityScan);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [cantonFilter, setCantonFilter] = useState<string>("");
  const [sortMode, setSortMode] = useState<SortMode>("score_asc");

  const cantons = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.canton && set.add(r.canton));
    return Array.from(set).sort();
  }, [rows]);

  const displayedRows = useMemo(() => {
    let list = cantonFilter ? rows.filter((r) => r.canton === cantonFilter) : rows.slice();
    list.sort((a, b) => {
      switch (sortMode) {
        case "score_desc": return b.score - a.score;
        case "trend_desc": {
          const da = a.score_previous == null ? -Infinity : a.score - a.score_previous;
          const db = b.score_previous == null ? -Infinity : b.score - b.score_previous;
          return db - da;
        }
        case "recent": {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
          return tb - ta;
        }
        case "name": return a.name.localeCompare(b.name);
        case "score_asc":
        default: return a.score - b.score;
      }
    });
    return list;
  }, [rows, cantonFilter, sortMode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchList();
      setRows(res.rows);
    } catch (e: any) {
      toast.error(e?.message ?? "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = useCallback(
    async (id: string) => {
      setSelected(id);
      setDetailLoading(true);
      try {
        setDetail(await fetchDetail({ data: { therapistId: id } }));
      } catch (e: any) {
        toast.error(e?.message ?? "Détail indisponible");
      } finally {
        setDetailLoading(false);
      }
    },
    [fetchDetail],
  );

  const refreshDetail = useCallback(async () => {
    if (selected) setDetail(await fetchDetail({ data: { therapistId: selected } }));
  }, [selected, fetchDetail]);

  const onScan = async () => {
    setScanning(true);
    try {
      const r = await scan();
      toast.success(`Scan terminé : ${r.processed} profils recalculés.`);
      await load();
      if (selected) await openDetail(selected);
    } catch (e: any) {
      toast.error(e?.message ?? "Scan impossible");
    } finally {
      setScanning(false);
    }
  };

  const onCitability = async () => {
    setMeasuring(true);
    try {
      const r = await citability({ data: {} });
      toast.success(`Citabilité IA mesurée : ${r.processed} fiches (${r.reachable} joignables).`);
      if (selected) await refreshDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "Mesure impossible");
    } finally {
      setMeasuring(false);
    }
  };

  const changeStatus = async (recoId: string, status: string) => {
    try {
      await setRecoStatus({ data: { id: recoId, status: status as any } });
      await refreshDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "Mise à jour impossible");
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6 text-white">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <HeartPulse className="text-cyan-300" />
          <div>
            <h1 className="text-2xl font-semibold">Santé des profils thérapeutes</h1>
            <p className="text-sm text-white/50">Score de visibilité /100, points forts, manques et actions prioritaires.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCitability}
            disabled={measuring}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-60"
          >
            {measuring ? <Loader2 className="animate-spin" size={16} /> : <Radar size={16} />}
            Mesurer citabilité IA
          </button>
          <button
            onClick={onScan}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {scanning ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
            Lancer un scan
          </button>
        </div>
      </header>

      <FounderSeatsPanel />

      {loading ? (
        <div className="flex items-center gap-2 text-white/60"><Loader2 className="animate-spin" size={16} /> Chargement…</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-2xl border border-[rgba(168,85,247,.25)] bg-[#2d1b4e]/60 p-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 p-2">
              <select
                value={cantonFilter}
                onChange={(e) => setCantonFilter(e.target.value)}
                className="rounded border border-white/15 bg-[#1a0a2e] px-2 py-1 text-xs text-white/80"
              >
                <option value="">Tous cantons ({rows.length})</option>
                {cantons.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded border border-white/15 bg-[#1a0a2e] px-2 py-1 text-xs text-white/80"
              >
                <option value="score_asc">Score ↑ (les plus faibles)</option>
                <option value="score_desc">Score ↓ (les plus forts)</option>
                <option value="trend_desc">Meilleure progression</option>
                <option value="recent">Plus récents</option>
                <option value="name">Nom (A→Z)</option>
              </select>
              <span className="ml-auto text-[11px] text-white/40">{displayedRows.length} affiché(s)</span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-white/50">
                <tr className="text-left"><th className="p-2">Thérapeute</th><th className="p-2">Score</th><th className="p-2">Tend.</th></tr>
              </thead>
              <tbody>
                {displayedRows.map((r) => (
                  <tr
                    key={r.therapist_id}
                    onClick={() => openDetail(r.therapist_id)}
                    className={`cursor-pointer border-t border-white/5 hover:bg-white/5 ${selected === r.therapist_id ? "bg-white/10" : ""}`}
                  >
                    <td className="p-2">{r.name || "—"} <span className="text-white/40">· {r.canton}</span></td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR[r.grade] }} />
                        {r.score}/100
                      </span>
                    </td>
                    <td className="p-2"><TrendBadge current={r.score} previous={r.score_previous} /></td>
                  </tr>
                ))}
                {displayedRows.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-white/50">{rows.length === 0 ? "Aucun score. Lancez un scan." : "Aucun résultat pour ce filtre."}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div>
            {!selected ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/40">
                Sélectionnez un thérapeute pour voir sa fiche.
              </div>
            ) : detailLoading || !detail ? (
              <div className="flex items-center gap-2 text-white/60"><Loader2 className="animate-spin" size={16} /> Chargement de la fiche…</div>
            ) : (
              <DetailCard therapistId={selected} detail={detail} onChangeStatus={changeStatus} onRefreshDetail={refreshDetail} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailCard({ therapistId, detail, onChangeStatus, onRefreshDetail }: { therapistId: string; detail: any; onChangeStatus: (id: string, s: string) => void; onRefreshDetail: () => Promise<void> }) {
  const t = detail.therapist ?? {};
  const tid = t.id ?? therapistId;
  const s = detail.score ?? {};
  const grade = s.grade ?? "red";
  const cit: number | null = s.ai_citability ?? null;

  const regen = useServerFn(regenerateArticleIdea);
  const queue = useServerFn(queueSuggestedArticle);
  const invite = useServerFn(sendProfileHealthInvite);
  const recap = useServerFn(sendProfileHealthRecap);
  const citabilityOne = useServerFn(runCitabilityScan);
  const [busy, setBusy] = useState<null | "regen" | "queue" | "invite" | "recap" | "cit">(null);

  const doCitability = async () => {
    setBusy("cit");
    try {
      const r = await citabilityOne({ data: { therapistId: tid } });
      if (r.processed === 0) toast.error("Aucune ligne de santé à mettre à jour — lancez d'abord le scan « Santé ».");
      else toast.success("Citabilité IA mesurée.");
      await onRefreshDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "Mesure impossible");
    } finally {
      setBusy(null);
    }
  };

  const specAvg = detail.specialtyAvg as { specialty: string | null; avg: number | null; sample: number } | undefined;
  const lastRecap = s.last_recap_sent_at ? new Date(s.last_recap_sent_at).toLocaleDateString("fr-CH") : null;

  const doRegen = async () => {
    setBusy("regen");
    try { await regen({ data: { therapistId: tid } }); toast.success("Nouvelle idée générée par l'IA."); await onRefreshDetail(); }
    catch (e: any) { toast.error(e?.message ?? "Échec"); } finally { setBusy(null); }
  };
  const doQueue = async () => {
    setBusy("queue");
    try { await queue({ data: { therapistId: tid } }); toast.success("Idée envoyée à l'agent GEO — brouillon à valider dans /admin/articles."); }
    catch (e: any) { toast.error(e?.message ?? "Échec"); } finally { setBusy(null); }
  };
  const doInvite = async () => {
    setBusy("invite");
    try { await invite({ data: { therapistId: tid } }); toast.success("Email d'invitation envoyé au thérapeute."); }
    catch (e: any) { toast.error(e?.message ?? "Échec"); } finally { setBusy(null); }
  };
  const doRecap = async () => {
    setBusy("recap");
    try { await recap({ data: { therapistId: tid } }); toast.success("Récapitulatif complet envoyé au thérapeute."); await onRefreshDetail(); }
    catch (e: any) { toast.error(e?.message ?? "Échec"); } finally { setBusy(null); }
  };

  return (
    <div className="rounded-2xl border border-[rgba(168,85,247,.25)] bg-[#2d1b4e]/80 p-6 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{t.first_name} {t.last_name}</h2>
          <p className="text-sm text-white/60">{t.email}{t.phone ? ` · ${t.phone}` : ""}</p>
          <p className="text-xs text-white/45">{[t.address, t.city, t.canton].filter(Boolean).join(", ")}</p>
          <p className="mt-1 text-xs text-white/45">
            Inscrit le {t.created_at ? new Date(t.created_at).toLocaleDateString("fr-CH") : "—"} · Formule {detail.plan}
            {t.slug ? (
              <> · <a className="text-cyan-300 underline" href={`/fr/therapeute/${t.slug}`} target="_blank" rel="noreferrer">Profil public <ExternalLink className="inline" size={11} /></a></>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-white/45">
            Spécialités : {(t.specialties ?? []).join(", ") || "—"} · Langues : {(t.languages ?? []).join(", ") || "—"}
          </p>
        </div>
        <Gauge value={s.score_total ?? 0} grade={grade} />
      </div>

      {specAvg?.avg != null && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
          <span className="text-white/60">Moyenne « {specAvg.specialty} » ({specAvg.sample} thérapeutes)</span>
          <span className="font-semibold text-white">
            {specAvg.avg}/100
            <span className={`ml-2 ${((s.score_total ?? 0) - specAvg.avg) >= 0 ? "text-green-400" : "text-amber-300"}`}>
              ({((s.score_total ?? 0) - specAvg.avg) >= 0 ? "+" : ""}{(s.score_total ?? 0) - specAvg.avg} vs moyenne)
            </span>
          </span>
        </div>
      )}

      {/* Citabilité IA — ADMIN UNIQUEMENT (jamais montrée au thérapeute) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2">
        <span className="text-xs text-amber-200/90">
          🔒 Citabilité IA <span className="text-amber-200/50">(admin uniquement)</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">
            {cit == null ? <span className="text-white/40">non mesurée</span> : `${cit}/100`}
          </span>
          <button
            type="button"
            onClick={doCitability}
            disabled={busy === "cit"}
            className="min-h-[36px] rounded-md border border-amber-400/40 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-50"
          >
            {busy === "cit" ? "Mesure…" : cit == null ? "Mesurer" : "Recalculer"}
          </button>
        </span>
      </div>


      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        {(["completude", "contenu", "activite", "visibilite"] as const).map((k) => (
          <div key={k} className="rounded-lg bg-white/5 p-2">
            <div className="font-semibold text-white">{s[`score_${k}`] ?? 0}<span className="text-white/40">/{CAT_MAX[k]}</span></div>
            <div className="text-white/50">{CAT_LABEL[k]}</div>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-2 text-center text-[11px] text-white/45">
        Réactivité aux messages · <span className="text-white/60">en cours de calibrage</span>
      </div>

      <TherapistScorePanel therapistId={tid} slug={t.slug ?? null} />

      <ShowcaseAudit therapistId={tid} />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="mb-1 text-sm font-semibold text-green-400">Points forts</h3>
          <ul className="space-y-1">
            {(s.strengths ?? []).map((x: any, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-white/80"><CheckCircle2 className="mt-0.5 shrink-0 text-green-400" size={14} /> {x.label}</li>
            ))}
            {(s.strengths ?? []).length === 0 && <li className="text-sm text-white/40">—</li>}
          </ul>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold text-amber-400">Manques</h3>
          <ul className="space-y-1">
            {(s.gaps ?? []).map((x: any, i: number) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-white/80"><AlertTriangle className="mt-0.5 shrink-0 text-amber-400" size={14} /> {x.label}</li>
            ))}
            {(s.gaps ?? []).length === 0 && <li className="text-sm text-white/40">—</li>}
          </ul>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-cyan-300">Actions prioritaires</h3>
        <ul className="mt-2 space-y-2">
          {detail.recommendations.map((r: any) => (
            <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className={r.status === "resolved" ? "text-white/40 line-through" : "text-white/85"}>
                {SEV_ICON[r.severity] ?? "🔵"} {r.label} <span className="text-cyan-300">+{r.impact_points} pts</span>
              </span>
              <select
                value={r.status}
                onChange={(e) => onChangeStatus(r.id, e.target.value)}
                className="rounded border border-white/15 bg-[#1a0a2e] px-2 py-1 text-xs text-white/80"
              >
                <option value="todo">À faire</option>
                <option value="in_progress">En cours</option>
                <option value="resolved">Résolu</option>
                <option value="dismissed">Ignoré</option>
              </select>
            </li>
          ))}
          {detail.recommendations.length === 0 && <li className="text-sm text-white/50">Rien à signaler 🎉</li>}
        </ul>
      </div>

      {/* Idée d'article + actions */}
      <div className="mt-4 rounded-lg border border-cyan-400/30 bg-cyan-400/10 p-3">
        <p className="text-sm text-white/90">
          ✍️ <b>Idée d'article « Voix d'experts » :</b> {s.article_idea || <span className="text-white/40">—</span>}
          {s.article_idea_source === "llm" && <span className="ml-2 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-200">IA</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={doRegen} disabled={busy === "regen"} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/5 disabled:opacity-60">
            {busy === "regen" ? <Loader2 className="animate-spin" size={13} /> : <Sparkles size={13} />} Régénérer via IA
          </button>
          <button onClick={doQueue} disabled={busy === "queue" || !s.article_idea} className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {busy === "queue" ? <Loader2 className="animate-spin" size={13} /> : <PenLine size={13} />} Rédiger l'article suggéré
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <button onClick={doInvite} disabled={busy === "invite"} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5 disabled:opacity-60">
          {busy === "invite" ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />} Email court (top 3 actions)
        </button>
        <button onClick={doRecap} disabled={busy === "recap"} className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy === "recap" ? <Loader2 className="animate-spin" size={14} /> : <FileText size={14} />} Envoyer récapitulatif complet
        </button>
        {lastRecap && <span className="text-[11px] text-white/40">Dernier envoi : {lastRecap}</span>}
      </div>
    </div>
  );
}

/** Contrôles automatiques de la vitrine publique (visibilité vs conversion). */
function ShowcaseAudit({ therapistId }: { therapistId: string }) {
  const run = useServerFn(auditTherapistShowcase);
  const loadAccess = useServerFn(getTherapistScoringAccess);
  const saveAccess = useServerFn(setTherapistScoringAccess);
  const saveSeat = useServerFn(setFounderSeat);
  const loadEvents = useServerFn(listScoringAccessEvents);
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [access, setAccess] = useState<any>(null);
  const [accessBusy, setAccessBusy] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState({
    source: "manual_grant",
    startsAt: "",
    expiresAt: "",
    note: "",
  });

  const launch = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await run({ data: { therapistId } });
      setState(res);
      setAccess(res?.access ?? null);
    } catch (e: any) {
      toast.error(e?.message ?? "Audit impossible");
    } finally {
      setLoading(false);
    }
  }, [run, therapistId]);

  const toggleAccess = useCallback(
    async (enabled: boolean) => {
      setAccessBusy(true);
      try {
        setAccess(
          await saveAccess({
            data: {
              therapistId,
              enabled,
              source: form.source as any,
              startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
              expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
              note: form.note || undefined,
            },
          }),
        );
        setEvents(await loadEvents({ data: { therapistId } }));
        toast.success(enabled ? "Accès avancé accordé" : "Accès avancé retiré");
      } catch (e: any) {
        toast.error(e?.message ?? "Modification impossible");
      } finally {
        setAccessBusy(false);
      }
    },
    [saveAccess, loadEvents, therapistId, form],
  );

  const toggleSeat = useCallback(
    async (enabled: boolean) => {
      setAccessBusy(true);
      try {
        await saveSeat({ data: { therapistId, enabled, source: "admin_manual" } });
        setAccess(await loadAccess({ data: { therapistId } }));
        toast.success(enabled ? "Place fondateur attribuée" : "Place fondateur retirée");
      } catch (e: any) {
        toast.error(e?.message ?? "Modification impossible");
      } finally {
        setAccessBusy(false);
      }
    },
    [saveSeat, loadAccess, therapistId],
  );

  useEffect(() => {
    setState(null);
    setAccess(null);
    setEvents([]);
    loadAccess({ data: { therapistId } })
      .then(setAccess)
      .catch(() => setAccess(null));
    loadEvents({ data: { therapistId } })
      .then((r: any) => setEvents(r ?? []))
      .catch(() => setEvents([]));
  }, [therapistId, loadAccess, loadEvents]);

  return (
    <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      {access && (
        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] p-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-white/85">
              Scoring avancé :{" "}
              <span className={access.advanced ? "text-green-400" : "text-white/50"}>
                {access.advanced ? "éligible" : "non éligible"}
              </span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={accessBusy}
                onClick={() => toggleAccess(true)}
                className="min-h-[32px] rounded-md border border-white/15 px-2 py-1 text-white/80 hover:bg-white/5 disabled:opacity-60"
              >
                Activer l'accès
              </button>
              <button
                type="button"
                disabled={accessBusy}
                onClick={() => toggleAccess(false)}
                className="min-h-[32px] rounded-md border border-white/15 px-2 py-1 text-white/70 hover:bg-white/5 disabled:opacity-60"
              >
                Désactiver l'accès
              </button>
              <button
                type="button"
                disabled={accessBusy}
                onClick={() => toggleSeat(access.seatStatus !== "active")}
                className="min-h-[32px] rounded-md border border-[#b86ef9]/40 bg-[#b86ef9]/10 px-2 py-1 text-[#e7d3ff] hover:bg-[#b86ef9]/20 disabled:opacity-60"
              >
                {access.seatStatus === "active" ? "Retirer la place fondateur" : "Attribuer une place fondateur"}
              </button>
            </div>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-white/60">
              Source
              <select
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                className="min-h-[36px] rounded-md border border-white/15 bg-[#1b0f2e] px-2 py-1 text-white/85"
              >
                <option value="founding_70">founding_70</option>
                <option value="elite_pro">elite_pro</option>
                <option value="commercial_offer">commercial_offer</option>
                <option value="manual_grant">manual_grant</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-white/60">
              Début
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="min-h-[36px] rounded-md border border-white/15 bg-[#1b0f2e] px-2 py-1 text-white/85"
              />
            </label>
            <label className="flex flex-col gap-1 text-white/60">
              Expiration
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="min-h-[36px] rounded-md border border-white/15 bg-[#1b0f2e] px-2 py-1 text-white/85"
              />
            </label>
            <label className="flex flex-col gap-1 text-white/60">
              Note interne
              <input
                type="text"
                maxLength={500}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Contexte commercial…"
                className="min-h-[36px] rounded-md border border-white/15 bg-[#1b0f2e] px-2 py-1 text-white/85 placeholder:text-white/30"
              />
            </label>
          </div>
          <p className="mt-1.5 text-white/50">
            Source : {access.sources?.length ? access.sources.join(", ") : "—"} · Rang d'inscription :{" "}
            {access.earlyRank ?? "—"} / {access.earlySlots} · Activation :{" "}
            {access.since ? new Date(access.since).toLocaleDateString("fr-CH") : "—"}
          </p>
          <p className="mt-1 text-white/50">
            Abonnement (source de vérité) : plan « {access.subscriptionPlan ?? "—"} » ·
            facture Elite en cours : {access.subscriptionVerified ? "oui" : "non"}
            {access.subscriptionPeriodEnd ? ` (jusqu'au ${new Date(access.subscriptionPeriodEnd).toLocaleDateString("fr-CH")})` : ""} ·
            Fenêtre accordée : {access.grantStartsAt ? new Date(access.grantStartsAt).toLocaleDateString("fr-CH") : "—"} →{" "}
            {access.grantExpiresAt ? new Date(access.grantExpiresAt).toLocaleDateString("fr-CH") : "sans expiration"}
            {access.grantNote ? ` · Note : ${access.grantNote}` : ""}
          </p>
          <p className="mt-1 text-white/50">
            Place fondateur : {access.seatNumber ? `n°${access.seatNumber} / ${access.earlySlots}` : "aucune"} ·
            Statut : {access.seatStatus === "active" ? "actif" : access.seatStatus === "revoked" ? "retiré" : "—"} ·
            Attribuée le {access.seatGrantedAt ? new Date(access.seatGrantedAt).toLocaleDateString("fr-CH") : "—"} ·
            Places restantes : {access.seatsRemaining ?? "—"}
          </p>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="mt-2 min-h-[32px] rounded-md border border-white/10 px-2 py-1 text-white/70 hover:bg-white/5"
            aria-expanded={showHistory}
          >
            Historique des accès ({events.length})
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1">
              {events.length === 0 && <li className="text-white/40">Aucune modification enregistrée.</li>}
              {events.map((ev) => (
                <li key={ev.id} className="rounded-md bg-white/5 px-2 py-1 text-white/65">
                  {new Date(ev.created_at).toLocaleString("fr-CH")} — {ev.action === "revoked" ? "retiré" : "accordé"} ·{" "}
                  {ev.source ?? "—"}
                  {ev.expires_at ? ` · expire le ${new Date(ev.expires_at).toLocaleDateString("fr-CH")}` : ""}
                  {ev.note ? ` · ${ev.note}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white/85">Contrôles automatiques de la vitrine</h3>
        <button
          type="button"
          onClick={launch}
          disabled={loading}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/5 disabled:opacity-60"
        >
          {loading ? <Loader2 className="animate-spin" size={13} /> : <Radar size={13} />}
          {state ? "Relancer" : "Lancer l'audit"}
        </button>
      </div>

      {!state && !loading && (
        <p className="mt-2 text-xs text-white/45">
          Vérifie 15 points réels de la fiche publique : contenu indexable, données locales, tarif,
          disponibilités, preuves de confiance.
        </p>
      )}

      {state && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-white/5 p-2">
              <div className="text-base font-semibold text-white">{state.totals.visibilite}<span className="text-white/40">/100</span></div>
              <div className="text-white/55">Visibilité (SEO / IA)</div>
            </div>
            <div className="rounded-lg bg-white/5 p-2">
              <div className="text-base font-semibold text-white">{state.totals.conversion}<span className="text-white/40">/100</span></div>
              <div className="text-white/55">Conversion</div>
            </div>
          </div>

          <ul className="mt-3 space-y-1">
            {state.checks.map((c: any) => (
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
                  {c.label}
                  {!c.passed && <span className="block text-white/45">{c.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
