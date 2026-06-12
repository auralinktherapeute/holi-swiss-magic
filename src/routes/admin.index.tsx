import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Users, UserCheck, Clock, CalendarDays, TrendingUp, Sparkles,
  ArrowUpRight, ArrowDownRight, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, CartesianGrid,
} from "recharts";
import { getAdminStats } from "@/lib/admin.functions";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/")({ component: Page });

const STATUS_MAP: Record<string, string> = {
  active: "active", pending: "pending", rejected: "rejected", suspended: "suspended",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_MAP[status] ?? "draft";
  const labels: Record<string, string> = {
    active: "Actif", pending: "En attente", rejected: "Rejeté",
    suspended: "Suspendu", draft: status,
  };
  return <span className={`adm-badge ${cls}`}>{labels[cls] ?? status}</span>;
}

function CountUp({ target, duration = 1000 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(Math.round(p * p * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return <>{val.toLocaleString("fr-CH")}</>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  trend,
  trendLabel,
  color,
  delay,
}: {
  icon: any; label: string; value: number | string; trend?: "up" | "down" | "neutral";
  trendLabel?: string; color: string; delay: number;
}) {
  return (
    <motion.div
      className="adm-kpi"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
    >
      <div className={`adm-kpi-icon ${color}`}>
        <Icon size={20} />
      </div>
      <div className="adm-kpi-value">
        {typeof value === "number" ? <CountUp target={value} /> : value}
      </div>
      <div className="adm-kpi-label">{label}</div>
      {trend && trendLabel && (
        <div className={`adm-kpi-trend ${trend}`}>
          {trend === "up" ? <ArrowUpRight size={12} /> : trend === "down" ? <ArrowDownRight size={12} /> : null}
          {trendLabel}
        </div>
      )}
    </motion.div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[160, 80, 70, 70].map((w, i) => (
        <td key={i} style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="adm-skeleton" style={{ height: 14, width: w, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1a1035", border: "1px solid rgba(184,110,249,0.3)",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#b86ef9", fontWeight: 600 }}>{payload[0].value} inscriptions</div>
    </div>
  );
};

// Import useState / useEffect needed for CountUp
import { useState, useEffect } from "react";

function Page() {
  const fetchStats = useServerFn(getAdminStats);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => fetchStats(),
    refetchInterval: 60_000,
  });

  const kpis = [
    { icon: Users,        label: "Total thérapeutes",   value: data?.totalTherapists ?? 0,      trend: "up" as const,    trendLabel: "+12% ce mois", color: "violet", delay: 0 },
    { icon: UserCheck,    label: "Thérapeutes actifs",   value: data?.activeTherapists ?? 0,     trend: "up" as const,    trendLabel: "En ligne",      color: "green",  delay: 0.05 },
    { icon: Clock,        label: "En attente",           value: data?.pendingTherapists ?? 0,    trend: "neutral" as const, trendLabel: "À traiter",    color: "yellow", delay: 0.1 },
    { icon: CalendarDays, label: "RDV ce mois",          value: data?.appointmentsThisMonth ?? 0, trend: "up" as const,   trendLabel: "+8%",           color: "cyan",   delay: 0.15 },
    { icon: TrendingUp,   label: "Revenus MRR",          value: data?.revenueMrr ? `${data.revenueMrr} CHF` : "0 CHF", color: "violet", delay: 0.2 },
    { icon: Sparkles,     label: "Nouveaux (7 jours)",   value: data?.newSignups7d ?? 0,         trend: "up" as const,    trendLabel: "Cette semaine", color: "cyan",   delay: 0.25 },
  ];

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page">

        {/* Header */}
        <motion.div
          className="adm-page-header"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h1 className="adm-page-title">Vue d'ensemble</h1>
              <p className="adm-page-subtitle">Tableau de bord HoliSwiss · mis à jour en temps réel</p>
            </div>
            <button className="adm-btn adm-btn-primary" style={{ fontSize: 13 }}>
              <Sparkles size={14} />
              Exporter rapport
            </button>
          </div>
        </motion.div>

        {/* KPI Grid */}
        <div className="adm-kpi-grid">
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>

        {/* Chart + Dernières inscriptions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

          {/* Sparkline inscriptions */}
          <motion.div
            className="adm-card"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.35 }}
          >
            <div className="adm-card-header">
              <span className="adm-card-title">Inscriptions — 30 derniers jours</span>
            </div>
            <div style={{ padding: "20px 8px 12px" }}>
              {isLoading ? (
                <div className="adm-skeleton" style={{ height: 160, borderRadius: 10 }} />
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data?.signupsSparkline ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradViolet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#b86ef9" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#b86ef9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.35)" }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone" dataKey="v"
                      stroke="#b86ef9" strokeWidth={2}
                      fill="url(#gradViolet)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>

          {/* Dernières inscriptions */}
          <motion.div
            className="adm-card"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.35 }}
          >
            <div className="adm-card-header">
              <span className="adm-card-title">Dernières inscriptions</span>
              <Link to="/admin/therapeutes" style={{ fontSize: 13, color: "#b86ef9", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                Voir tout <ChevronRight size={14} />
              </Link>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Thérapeute</th>
                    <th>Canton</th>
                    <th>Statut</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    : (data?.lastTherapists ?? []).map((th: any, i: number) => (
                      <motion.tr
                        key={th.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        transition={{ delay: 0.05 * i }}
                      >
                        <td>
                          <Link
                            to="/$lang/therapeute/$slug"
                            params={{ lang: "fr", slug: th.slug }}
                            style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}
                          >
                            {th.first_name} {th.last_name}
                          </Link>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{th.email ?? "—"}</div>
                        </td>
                        <td>{th.canton ?? "—"}</td>
                        <td><StatusBadge status={th.status} /></td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {new Date(th.created_at).toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                      </motion.tr>
                    ))
                  }
                  {!isLoading && (data?.lastTherapists ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="adm-empty">
                          <div className="adm-empty-icon"><Users size={24} /></div>
                          <div className="adm-empty-title">Aucune inscription</div>
                          <div className="adm-empty-sub">Les nouvelles inscriptions apparaîtront ici</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Derniers RDV */}
        <motion.div
          className="adm-card"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.35 }}
        >
          <div className="adm-card-header">
            <span className="adm-card-title">Dernières réservations</span>
            <Link to="/admin/evenements" style={{ fontSize: 13, color: "#b86ef9", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
              Voir tout <ChevronRight size={14} />
            </Link>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Thérapeute</th>
                  <th>Date</th>
                  <th>Heure</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
                  : (data?.lastAppointments ?? []).map((a: any, i: number) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: 0.05 * i }}
                    >
                      <td>{a.patient_name}</td>
                      <td style={{ color: "rgba(255,255,255,0.6)" }}>{a.therapist_name ?? "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{a.appointment_date}</td>
                      <td>{a.appointment_time}</td>
                      <td><StatusBadge status={a.status} /></td>
                    </motion.tr>
                  ))
                }
                {!isLoading && (data?.lastAppointments ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="adm-empty">
                        <div className="adm-empty-icon"><CalendarDays size={24} /></div>
                        <div className="adm-empty-title">Aucune réservation</div>
                        <div className="adm-empty-sub">Les réservations apparaîtront ici</div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
