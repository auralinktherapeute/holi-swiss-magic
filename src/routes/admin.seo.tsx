import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Gauge, RefreshCw, Sparkles, Search, Clock } from "lucide-react";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/seo")({ component: SeoPage });

type AuditData = {
  global: number;
  seo: number;
  geo: number;
  lastAuditAt: string; // ISO
};

// Mock seed — Part 2 will replace this with a real server fn + DB persistence.
const SEED: AuditData = {
  global: 78,
  seo: 82,
  geo: 74,
  lastAuditAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
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

function formatRelative(iso: string) {
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
  const [data, setData] = useState<AuditData>(SEED);
  const [running, setRunning] = useState(false);

  const lastLabel = useMemo(() => formatRelative(data.lastAuditAt), [data.lastAuditAt]);

  const runAudit = async () => {
    if (running) return;
    setRunning(true);
    // Part 2 will hit a real createServerFn here. For now we simulate.
    await new Promise((r) => setTimeout(r, 2200));
    setData((d) => ({
      ...d,
      global: Math.max(40, Math.min(99, d.global + Math.round((Math.random() - 0.3) * 6))),
      seo: Math.max(40, Math.min(99, d.seo + Math.round((Math.random() - 0.3) * 6))),
      geo: Math.max(40, Math.min(99, d.geo + Math.round((Math.random() - 0.3) * 6))),
      lastAuditAt: new Date().toISOString(),
    }));
    setRunning(false);
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
            Dernier audit complet : {new Date(data.lastAuditAt).toLocaleString("fr-CH", {
              dateStyle: "medium", timeStyle: "short",
            })}
          </div>
        </div>
      </motion.section>

      {/* Placeholder for Parts 2-4 */}
      <div style={{
        marginTop: 24, padding: 24, borderRadius: 16,
        border: "1px dashed rgba(255,255,255,0.12)",
        color: "rgba(255,255,255,0.45)", fontSize: 13, textAlign: "center",
      }}>
        Rapport détaillé et graphique d'évolution : à venir (parties 2, 3 et 4).
      </div>

      <style>{`@keyframes adm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}