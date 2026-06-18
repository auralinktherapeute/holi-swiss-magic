import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Gauge, RefreshCw, Sparkles, Search, Clock,
  CheckCircle2, AlertTriangle, AlertOctagon, Filter, Loader2, TrendingUp,
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, ReferenceDot,
} from "recharts";
import {
  listSeoFindings, updateSeoFindingStatus, getSeoHistory,
  getLatestAudit, runSeoAuditNow,
  type SeoFinding, type SeoHistoryPoint,
} from "@/lib/seo-audit.functions";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/seo")({ component: SeoPage });

type AuditData = {
  global: number;
  seo: number;
  geo: number;
  lastAuditAt: string | null;
};

function scoreColor(v: number) {
  if (v < 50) return { stroke: "#ef4444", glow: "rgba(239,68,68,0.45)", label: "Critique" };
  if (v < 75) return { stroke: "#f59e0b", glow: "rgba(245,158,11,0.45)", label: "À améliorer" };
  if (v < 90) return { stroke: "#84cc16", glow: "rgba(132,204,22,0.45)", label: "Bon" };
  return { stroke: "#22c55e", glow: "rgba(34,197,94,0.55)", label: "Excellent" };
}

function useCountUp(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function GaugeRing({ value, size = 240, stroke = 18 }: { value: number; size?: number; stroke?: number }) {
  const v = useCountUp(value);
  const { stroke: color, glow, label } = scoreColor(v);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // 270deg arc (3/4 turn) for speedometer feel
  const arc = c * 0.75;
  const offset = arc - (arc * v) / 100;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(135deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none"
          strokeDasharray={`${arc} ${c}`} strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={`${arc} ${c}`} strokeLinecap="round"
          initial={{ strokeDashoffset: arc }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 12px ${glow})` }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 4, pointerEvents: "none",
      }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", letterSpacing: 1.5, textTransform: "uppercase" }}>
          Score global
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, color: "#fff", lineHeight: 1, fontFamily: "'Inter', system-ui" }}>
          {v}
        </div>
        <div style={{ fontSize: 13, color, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

function MiniScore({
  icon: Icon, label, sub, value, delay,
}: { icon: any; label: string; sub: string; value: number; delay: number }) {
  const v = useCountUp(value);
  const { stroke: color } = scoreColor(v);
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      style={{
        flex: 1, minWidth: 240,
        background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16, padding: 20,
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}1f`, color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={18} />
        </div>
        <div>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>{label}</div>
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{sub}</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 42, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{v}</div>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>/100</div>
      </div>
      <div style={{
        height: 8, borderRadius: 999,
        background: "rgba(255,255,255,0.06)", overflow: "hidden",
      }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${v}%` }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          style={{ height: "100%", background: color, borderRadius: 999 }}
        />
      </div>
    </motion.div>
  );
}

function formatRelative(iso: string | null) {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return `il y a ${d} j`;
}

function SeoPage() {
  const fetchLatest = useServerFn(getLatestAudit);
  const runNow = useServerFn(runSeoAuditNow);
  const qc = useQueryClient();

  const { data: latest } = useQuery({
    queryKey: ["seo-latest-audit"],
    queryFn: () => fetchLatest(),
    staleTime: 30_000,
  });

  const data: AuditData = {
    global: latest?.global ?? 0,
    seo: latest?.seo ?? 0,
    geo: latest?.geo ?? 0,
    lastAuditAt: latest?.lastAuditAt ?? null,
  };

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  const lastLabel = useMemo(() => formatRelative(data.lastAuditAt), [data.lastAuditAt]);

  const runAudit = async () => {
    if (running) return;
    setRunning(true);
    setProgress(5);
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      // ease toward 90% over ~20s; the real call settles the rest.
      setProgress((p) => Math.min(90, Math.max(p, Math.round(5 + (elapsed / 220)))));
    }, 200);
    try {
      const r = await runNow({});
      setProgress(100);
      toast.success(`Audit terminé — Score SEO : ${r.seo_score} / Score GEO : ${r.geo_score}`, {
        description: r.critical_count
          ? `${r.critical_count} point(s) critique(s) détecté(s) — ${r.audited_urls} URLs analysées.`
          : `${r.audited_urls} URLs analysées. Aucun point critique.`,
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["seo-latest-audit"] }),
        qc.invalidateQueries({ queryKey: ["seo-history"] }),
        qc.invalidateQueries({ queryKey: ["seo-findings"] }),
      ]);
    } catch (e) {
      toast.error("L'audit a échoué", { description: (e as Error).message });
    } finally {
      clearInterval(tick);
      setTimeout(() => { setRunning(false); setProgress(0); }, 600);
    }
  };

  return (
    <div style={{ padding: "32px 28px", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Page heading */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
            <Gauge size={26} color="#a78bfa" /> Score SEO &amp; GEO
          </h1>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.55)", fontSize: 14 }}>
            Audit automatisé de la santé du site et de sa visibilité dans les moteurs IA.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "8px 14px", borderRadius: 999,
            background: running ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)",
            border: `1px solid ${running ? "rgba(245,158,11,0.35)" : "rgba(34,197,94,0.35)"}`,
            color: running ? "#fbbf24" : "#86efac",
            fontSize: 13, fontWeight: 500,
          }}>
            <Clock size={14} />
            {running ? "Analyse en cours…" : `Dernière analyse : ${lastLabel}`}
          </div>
          <button
            type="button"
            onClick={runAudit}
            disabled={running}
            aria-label="Lancer un audit SEO et GEO maintenant"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 12,
              background: running
                ? "rgba(167,139,250,0.4)"
                : "linear-gradient(135deg, #8b5cf6, #6366f1)",
              color: "#fff", border: "none", fontWeight: 600, fontSize: 14,
              cursor: running ? "wait" : "pointer",
              boxShadow: running ? "none" : "0 8px 24px rgba(139,92,246,0.35)",
              transition: "transform .15s ease, box-shadow .15s ease",
              minHeight: 44,
            }}
            onMouseEnter={(e) => { if (!running) e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <RefreshCw size={16} style={{ animation: running ? "adm-spin 1s linear infinite" : "none" }} />
            {running ? "Analyse en cours…" : "Lancer un audit maintenant"}
          </button>
        </div>
      </div>

      {/* Header card */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{
          position: "relative",
          background: "radial-gradient(circle at 20% 0%, rgba(139,92,246,0.18), transparent 55%), linear-gradient(180deg, #181034, #110a26)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24,
          padding: 28,
          display: "flex",
          gap: 32,
          alignItems: "center",
          flexWrap: "wrap",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", flex: "0 0 auto" }}>
          <GaugeRing value={data.global} />
        </div>

        <div style={{ flex: 1, minWidth: 280, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <MiniScore
              icon={Search}
              label="Score SEO"
              sub="Visibilité Google classique"
              value={data.seo}
              delay={0.15}
            />
            <MiniScore
              icon={Sparkles}
              label="Score GEO"
              sub="Visibilité dans les IA (ChatGPT, Perplexity, Gemini)"
              value={data.geo}
              delay={0.25}
            />
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.65)", fontSize: 13,
          }}>
            <Clock size={14} color="#a78bfa" />
            Dernier audit complet : {data.lastAuditAt
              ? new Date(data.lastAuditAt).toLocaleString("fr-CH", { dateStyle: "medium", timeStyle: "short" })
              : "aucun audit pour le moment"}
          </div>
        </div>
      </motion.section>

      {/* Part 2 — Detailed audit report */}
      <FindingsReport />

      {/* Part 3 — Evolution chart */}
      <EvolutionChart />

      {/* Part 4 — Automated agent status */}
      <section style={{
        marginTop: 24, padding: 18, borderRadius: 16,
        background: "linear-gradient(180deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))",
        border: "1px solid rgba(34,197,94,0.18)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        color: "rgba(255,255,255,0.75)", fontSize: 13.5,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(34,197,94,0.15)", color: "#86efac",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
            Agent d'audit automatisé activé
          </div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12.5, marginTop: 2 }}>
            Analyse quotidienne planifiée à 06:00 UTC · 7 URLs principales surveillées · alerte admin en cas de point critique.
          </div>
        </div>
      </section>

      {/* Audit progress overlay */}
      {running && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(8,4,24,0.72)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
          role="status" aria-live="polite"
        >
          <div style={{
            background: "linear-gradient(180deg, #1a1140, #110a26)",
            border: "1px solid rgba(139,92,246,0.35)",
            borderRadius: 20, padding: 28, width: "min(420px, 100%)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Loader2 size={20} color="#a78bfa" style={{ animation: "adm-spin 1s linear infinite" }} />
              <div style={{ color: "#fff", fontWeight: 600, fontSize: 15 }}>Analyse SEO & GEO en cours…</div>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 14 }}>
              Le robot parcourt les pages clés du site et évalue leur visibilité.
            </div>
            <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{
                  height: "100%", borderRadius: 999,
                  background: "linear-gradient(90deg, #8b5cf6, #22d3ee)",
                  boxShadow: "0 0 16px rgba(139,92,246,0.6)",
                }}
              />
            </div>
            <div style={{ marginTop: 8, color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "right" }}>
              {progress}%
            </div>
          </div>
        </motion.div>
      )}

      <style>{`
        @keyframes adm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes adm-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
          50%      { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
        }
        .adm-critical-badge { animation: adm-pulse 1.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Part 2 — Detailed findings report                                 */
/* ---------------------------------------------------------------- */

const CATEGORY_LABELS: Record<SeoFinding["category"], string> = {
  seo_onpage: "SEO On-Page",
  seo_technical: "SEO Technique",
  seo_local: "SEO Local",
  geo: "GEO (IA)",
  multilang: "Multilingue",
  accessibility: "Accessibilité",
};

const SEVERITY_META: Record<SeoFinding["severity"], { color: string; bg: string; icon: any; label: string; dot: string }> = {
  critical: { color: "#fca5a5", bg: "rgba(239,68,68,0.12)", icon: AlertOctagon, label: "Critique", dot: "🔴" },
  warning:  { color: "#fbbf24", bg: "rgba(245,158,11,0.12)", icon: AlertTriangle, label: "À améliorer", dot: "🟡" },
  good:     { color: "#86efac", bg: "rgba(34,197,94,0.12)",  icon: CheckCircle2, label: "Bon", dot: "🟢" },
};

const PRIORITY_META: Record<SeoFinding["priority"], { color: string; bg: string; label: string }> = {
  P1: { color: "#fca5a5", bg: "rgba(239,68,68,0.15)",  label: "P1 · Urgent" },
  P2: { color: "#fbbf24", bg: "rgba(245,158,11,0.15)", label: "P2 · Important" },
  P3: { color: "#a5b4fc", bg: "rgba(99,102,241,0.15)", label: "P3 · À planifier" },
};

type StatusFilter = "all" | "critical" | "warning" | "resolved";
type CategoryFilter = "all" | SeoFinding["category"];
type PriorityFilter = "all" | SeoFinding["priority"];

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px", borderRadius: 999,
        background: active ? "linear-gradient(135deg, #8b5cf6, #6366f1)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.7)",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
        minHeight: 36, transition: "background .15s ease",
      }}
    >
      {children}
    </button>
  );
}

function FindingCard({
  finding, onResolve, busy,
}: { finding: SeoFinding; onResolve: () => void; busy: boolean }) {
  const sev = SEVERITY_META[finding.severity];
  const prio = PRIORITY_META[finding.priority];
  const resolved = finding.status === "resolved";
  const Icon = sev.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        background: resolved
          ? "linear-gradient(180deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        border: `1px solid ${resolved ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 16, padding: 18,
        display: "flex", gap: 16, alignItems: "flex-start",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12, flex: "0 0 auto",
        background: resolved ? "rgba(34,197,94,0.15)" : sev.bg,
        color: resolved ? "#86efac" : sev.color,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {resolved ? <CheckCircle2 size={20} /> : <Icon size={20} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <span style={{
            padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: sev.bg, color: sev.color, letterSpacing: 0.3,
          }}>{sev.label}</span>
          <span style={{
            padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: prio.bg, color: prio.color,
          }}>{prio.label}</span>
          <span style={{
            padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 500,
            background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.65)",
          }}>{CATEGORY_LABELS[finding.category]}</span>
          {resolved && (
            <span style={{
              padding: "3px 9px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              background: "rgba(34,197,94,0.15)", color: "#86efac",
            }}>✓ Résolu</span>
          )}
        </div>
        <h3 style={{
          margin: "0 0 4px", color: "#fff", fontSize: 16, fontWeight: 600,
          textDecoration: resolved ? "line-through" : "none",
          opacity: resolved ? 0.7 : 1,
        }}>{finding.title}</h3>
        <p style={{ margin: "0 0 10px", color: "rgba(255,255,255,0.65)", fontSize: 13.5, lineHeight: 1.5 }}>
          {finding.description}
        </p>
        <div style={{
          padding: "10px 12px", borderRadius: 10,
          background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.2)",
          color: "rgba(255,255,255,0.8)", fontSize: 13, lineHeight: 1.45,
        }}>
          <strong style={{ color: "#c4b5fd" }}>Action recommandée : </strong>
          {finding.action}
        </div>
      </div>

      <button
        type="button"
        onClick={onResolve}
        disabled={busy}
        aria-label={resolved ? "Rouvrir ce point" : "Marquer comme résolu"}
        style={{
          flex: "0 0 auto",
          padding: "8px 14px", borderRadius: 10,
          background: resolved ? "rgba(255,255,255,0.06)" : "rgba(34,197,94,0.15)",
          border: `1px solid ${resolved ? "rgba(255,255,255,0.12)" : "rgba(34,197,94,0.35)"}`,
          color: resolved ? "rgba(255,255,255,0.7)" : "#86efac",
          fontSize: 12.5, fontWeight: 600, cursor: busy ? "wait" : "pointer",
          minHeight: 36, display: "inline-flex", alignItems: "center", gap: 6,
          whiteSpace: "nowrap",
        }}
      >
        {busy ? <Loader2 size={14} style={{ animation: "adm-spin 1s linear infinite" }} /> :
          resolved ? "Rouvrir" : <><CheckCircle2 size={14} /> Marquer résolu</>}
      </button>
    </motion.div>
  );
}

function FindingsReport() {
  const list = useServerFn(listSeoFindings);
  const update = useServerFn(updateSeoFindingStatus);
  const qc = useQueryClient();

  const { data: findings = [], isLoading, error } = useQuery({
    queryKey: ["seo-findings"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (vars: { code: string; status: "open" | "resolved" }) => update({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["seo-findings"] }),
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  const filtered = useMemo(() => {
    return findings.filter((f) => {
      if (statusFilter === "resolved" && f.status !== "resolved") return false;
      if (statusFilter === "critical" && (f.severity !== "critical" || f.status === "resolved")) return false;
      if (statusFilter === "warning"  && (f.severity !== "warning"  || f.status === "resolved")) return false;
      if (statusFilter === "all"      && f.status === "resolved") return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && f.priority !== priorityFilter) return false;
      return true;
    });
  }, [findings, statusFilter, categoryFilter, priorityFilter]);

  const counts = useMemo(() => ({
    total: findings.length,
    critical: findings.filter((f) => f.severity === "critical" && f.status !== "resolved").length,
    warning: findings.filter((f) => f.severity === "warning" && f.status !== "resolved").length,
    resolved: findings.filter((f) => f.status === "resolved").length,
  }), [findings]);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 700 }}>
          Rapport d'audit détaillé
        </h2>
        <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
          {counts.total} points · {counts.critical} critiques · {counts.warning} à améliorer · {counts.resolved} résolus
        </span>
      </div>

      {/* Filters */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16, padding: 16, marginBottom: 16,
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <FilterRow label="Statut" icon={<Filter size={14} />}>
          {([
            ["all", "Tous (ouverts)"],
            ["critical", "🔴 Critiques"],
            ["warning", "🟡 À améliorer"],
            ["resolved", "✓ Résolus"],
          ] as [StatusFilter, string][]).map(([k, l]) => (
            <FilterChip key={k} active={statusFilter === k} onClick={() => setStatusFilter(k)}>{l}</FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Catégorie">
          <FilterChip active={categoryFilter === "all"} onClick={() => setCategoryFilter("all")}>Toutes</FilterChip>
          {(Object.keys(CATEGORY_LABELS) as SeoFinding["category"][]).map((c) => (
            <FilterChip key={c} active={categoryFilter === c} onClick={() => setCategoryFilter(c)}>
              {CATEGORY_LABELS[c]}
            </FilterChip>
          ))}
        </FilterRow>

        <FilterRow label="Priorité">
          <FilterChip active={priorityFilter === "all"} onClick={() => setPriorityFilter("all")}>Toutes</FilterChip>
          {(["P1", "P2", "P3"] as const).map((p) => (
            <FilterChip key={p} active={priorityFilter === p} onClick={() => setPriorityFilter(p)}>
              {PRIORITY_META[p].label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
          <Loader2 size={20} style={{ animation: "adm-spin 1s linear infinite", display: "inline-block" }} />
          <div style={{ marginTop: 8, fontSize: 13 }}>Chargement de l'audit…</div>
        </div>
      ) : error ? (
        <div style={{
          padding: 20, borderRadius: 12,
          background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
          color: "#fca5a5", fontSize: 13.5,
        }}>
          Impossible de charger le rapport d'audit. {(error as Error).message}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          padding: 32, textAlign: "center", borderRadius: 16,
          border: "1px dashed rgba(255,255,255,0.1)",
          color: "rgba(255,255,255,0.5)", fontSize: 14,
        }}>
          Aucun point ne correspond à ces filtres. 🎉
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((f) => (
            <FindingCard
              key={f.id}
              finding={f}
              busy={mutation.isPending && mutation.variables?.code === f.code}
              onResolve={() => mutation.mutate({
                code: f.code,
                status: f.status === "resolved" ? "open" : "resolved",
              })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FilterRow({
  label, icon, children,
}: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        color: "rgba(255,255,255,0.5)", fontSize: 12,
        fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase",
        minWidth: 80,
      }}>
        {icon} {label}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Part 3 — Evolution chart                                          */
/* ---------------------------------------------------------------- */

type Period = 7 | 30 | 60 | 90;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7,  label: "7 jours" },
  { value: 30, label: "30 jours" },
  { value: 60, label: "60 jours" },
  { value: 90, label: "90 jours" },
];

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "short" });
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as SeoHistoryPoint & {
    prevSeo?: number; prevGeo?: number; prevGlobal?: number;
  };
  const delta = (cur: number, prev?: number) => {
    if (prev == null) return null;
    const d = cur - prev;
    if (d === 0) return <span style={{ color: "rgba(255,255,255,0.4)" }}> · =</span>;
    return (
      <span style={{ color: d > 0 ? "#86efac" : "#fca5a5", marginLeft: 4 }}>
        {d > 0 ? "+" : ""}{d}
      </span>
    );
  };
  return (
    <div style={{
      background: "rgba(13,8,32,0.96)",
      border: "1px solid rgba(139,92,246,0.35)",
      borderRadius: 12, padding: "12px 14px",
      color: "#fff", fontSize: 12.5, minWidth: 180,
      boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontWeight: 600, marginBottom: 8, color: "#c4b5fd" }}>
        {new Date(label + "T00:00:00").toLocaleDateString("fr-CH", {
          weekday: "short", day: "2-digit", month: "long",
        })}
      </div>
      <Row color="#fbbf24" label="Global" value={p.global} delta={delta(p.global, p.prevGlobal)} />
      <Row color="#a78bfa" label="SEO"    value={p.seo}    delta={delta(p.seo,    p.prevSeo)} />
      <Row color="#22d3ee" label="GEO"    value={p.geo}    delta={delta(p.geo,    p.prevGeo)} />
      {p.hasReport && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.6)", fontSize: 11,
        }}>
          📋 Rapport disponible — cliquez sur le point
        </div>
      )}
    </div>
  );
}

function Row({ color, label, value, delta }: { color: string; label: string; value: number; delta: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
      <span style={{ flex: 1, color: "rgba(255,255,255,0.7)" }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
      {delta}
    </div>
  );
}

function EvolutionChart() {
  const fetchHistory = useServerFn(getSeoHistory);
  const [period, setPeriod] = useState<Period>(30);
  const [selectedDay, setSelectedDay] = useState<SeoHistoryPoint | null>(null);

  const { data: history = [], isLoading, error } = useQuery({
    queryKey: ["seo-history", period],
    queryFn: () => fetchHistory({ data: { days: period } }),
    staleTime: 60_000,
  });

  // Enrich with previous-day values for tooltip delta.
  const enriched = useMemo(() => {
    return history.map((p, i) => ({
      ...p,
      prevSeo:    i > 0 ? history[i - 1].seo    : undefined,
      prevGeo:    i > 0 ? history[i - 1].geo    : undefined,
      prevGlobal: i > 0 ? history[i - 1].global : undefined,
    }));
  }, [history]);

  // Report markers: a few days flagged as "audit complet" (every ~7d + last point).
  const reportDays = useMemo(() => {
    if (history.length === 0) return [] as SeoHistoryPoint[];
    const step = Math.max(1, Math.floor(history.length / 6));
    const picks: SeoHistoryPoint[] = [];
    for (let i = history.length - 1; i >= 0; i -= step) picks.push(history[i]);
    return picks;
  }, [history]);

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp size={20} color="#a78bfa" />
          <h2 style={{ margin: 0, color: "#fff", fontSize: 20, fontWeight: 700 }}>
            Évolution des scores
          </h2>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              aria-pressed={period === p.value}
              style={{
                padding: "8px 14px", borderRadius: 10,
                background: period === p.value
                  ? "linear-gradient(135deg, #8b5cf6, #6366f1)"
                  : "rgba(255,255,255,0.04)",
                border: `1px solid ${period === p.value ? "transparent" : "rgba(255,255,255,0.08)"}`,
                color: period === p.value ? "#fff" : "rgba(255,255,255,0.7)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", minHeight: 36,
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: "linear-gradient(180deg, #181034, #110a26)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20, padding: 20,
      }}>
        {isLoading ? (
          <div style={{ height: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)" }}>
            <Loader2 size={22} style={{ animation: "adm-spin 1s linear infinite" }} />
          </div>
        ) : error ? (
          <div style={{ padding: 24, color: "#fca5a5", fontSize: 13 }}>
            Impossible de charger l'historique. {(error as Error).message}
          </div>
        ) : enriched.length === 0 ? (
          <div style={{ padding: 24, color: "rgba(255,255,255,0.5)", fontSize: 13, textAlign: "center" }}>
            Pas encore de données d'audit pour cette période.
          </div>
        ) : (
          <>
            {/* Legend */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12, fontSize: 12.5 }}>
              <LegendDot color="#fbbf24" label="Score combiné" />
              <LegendDot color="#a78bfa" label="SEO" />
              <LegendDot color="#22d3ee" label="GEO" />
              <span style={{ color: "rgba(255,255,255,0.4)", marginLeft: "auto" }}>
                Les bulles dorées marquent un audit complet — cliquez pour ouvrir le rapport du jour.
              </span>
            </div>

            <div style={{ width: "100%", height: 340 }}>
              <ResponsiveContainer>
                <LineChart data={enriched} margin={{ top: 16, right: 12, left: -10, bottom: 4 }}>
                  <defs>
                    <filter id="seo-glow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="2.5" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    stroke="rgba(255,255,255,0.35)"
                    tick={{ fontSize: 11 }}
                    minTickGap={24}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="rgba(255,255,255,0.35)"
                    tick={{ fontSize: 11 }}
                    width={36}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(167,139,250,0.3)", strokeWidth: 1 }} />
                  <Line
                    type="monotone" dataKey="seo" stroke="#a78bfa" strokeWidth={2}
                    dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 1 }}
                    isAnimationActive animationDuration={1200} animationEasing="ease-out"
                  />
                  <Line
                    type="monotone" dataKey="geo" stroke="#22d3ee" strokeWidth={2}
                    dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 1 }}
                    isAnimationActive animationDuration={1400} animationEasing="ease-out"
                  />
                  <Line
                    type="monotone" dataKey="global" stroke="#fbbf24" strokeWidth={2.5}
                    dot={false} activeDot={{ r: 6, stroke: "#fff", strokeWidth: 1.5 }}
                    style={{ filter: "url(#seo-glow)" }}
                    isAnimationActive animationDuration={1600} animationEasing="ease-out"
                  />
                  {reportDays.map((d) => (
                    <ReferenceDot
                      key={d.date}
                      x={d.date}
                      y={d.global}
                      r={6}
                      fill="#fbbf24"
                      stroke="#fff"
                      strokeWidth={1.5}
                      onClick={() => setSelectedDay(d)}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>

      {/* Day report drawer */}
      {selectedDay && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginTop: 12, padding: 16, borderRadius: 14,
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.35)",
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "rgba(251,191,36,0.18)", color: "#fbbf24",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <TrendingUp size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>
              Audit du {new Date(selectedDay.date + "T00:00:00").toLocaleDateString("fr-CH", {
                weekday: "long", day: "2-digit", month: "long", year: "numeric",
              })}
            </div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 4 }}>
              Global <strong style={{ color: "#fbbf24" }}>{selectedDay.global}</strong> ·
              SEO <strong style={{ color: "#a78bfa" }}> {selectedDay.seo}</strong> ·
              GEO <strong style={{ color: "#22d3ee" }}> {selectedDay.geo}</strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            style={{
              padding: "8px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.8)",
              border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer",
              fontSize: 13, minHeight: 36,
            }}
          >
            Fermer
          </button>
        </motion.div>
      )}
    </section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.7)" }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: color, boxShadow: `0 0 8px ${color}55` }} />
      {label}
    </span>
  );
}