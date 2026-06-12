import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CreditCard, Users, TrendingUp, AlertCircle, ExternalLink, Download } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/abonnements")({ component: Page });

const SUBS = [
  { id: "sub_001", customer: "Claire Dupont",  plan: "Pro",     amount: "29 CHF", status: "active",   next: "1 juil. 2026" },
  { id: "sub_002", customer: "Anna Bianchi",   plan: "Premium", amount: "59 CHF", status: "active",   next: "12 juin 2026" },
  { id: "sub_003", customer: "Marc Reber",     plan: "Pro",     amount: "29 CHF", status: "past_due", next: "—" },
  { id: "sub_004", customer: "Sofia Rossi",    plan: "Pro",     amount: "29 CHF", status: "cancelled",next: "—" },
];

const PLAN_DATA = [
  { name: "Free",    value: 124, color: "rgba(255,255,255,0.2)" },
  { name: "Pro",     value: 98,  color: "#b86ef9" },
  { name: "Premium", value: 14,  color: "#5cc8fa" },
];

const STATUS_MAP: Record<string, string> = { active: "active", past_due: "pending", cancelled: "cancelled" };
const STATUS_LABELS: Record<string, string> = { active: "Actif", past_due: "Impayé", cancelled: "Annulé" };
const PLAN_COLORS: Record<string, { bg: string; color: string }> = {
  Pro:     { bg: "rgba(184,110,249,0.15)", color: "#b86ef9" },
  Premium: { bg: "rgba(92,200,250,0.15)",  color: "#5cc8fa" },
  Free:    { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" },
};

function exportCSV() {
  const header = ["Client","Plan","Montant","Statut","Prochain prélèvement","ID"];
  const lines = SUBS.map((s) => [s.customer, s.plan, s.amount, STATUS_LABELS[s.status] ?? s.status, s.next, s.id].map((v) => `"${v}"`).join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `abonnements_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1a1035", border: "1px solid rgba(184,110,249,0.3)", borderRadius: 10, padding: "10px 14px", fontSize: 12 }}>
      <strong style={{ color: "#fff" }}>{payload[0].name}</strong>
      <div style={{ color: "#b86ef9" }}>{payload[0].value} thérapeutes</div>
    </div>
  );
};

function Page() {
  const kpis = [
    { icon: TrendingUp,  label: "MRR",              value: "3 248 CHF", trend: "up" as const,   trendLabel: "+8% vs mois -1", color: "violet" },
    { icon: Users,       label: "Abonnés actifs",    value: "112",       trend: "up" as const,   trendLabel: "98 Pro · 14 Premium", color: "cyan" },
    { icon: AlertCircle, label: "Churn (30j)",        value: "2,1%",      trend: "neutral" as const, trendLabel: "Stable",       color: "yellow" },
    { icon: CreditCard,  label: "Échecs paiement",   value: "3",         trend: "down" as const, trendLabel: "À relancer",     color: "red" },
  ];

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page">

        <motion.div
          className="adm-page-header"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 className="adm-page-title">Abonnements</h1>
              <p className="adm-page-subtitle">Facturation Stripe · revenus & subscriptions</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <span className="adm-badge pending">⚠ Stripe en mode démo</span>
              <button className="adm-btn adm-btn-secondary" style={{ fontSize: 13 }} onClick={exportCSV}>
                <Download size={14} /> Exporter CSV
              </button>
              <button
                className="adm-btn adm-btn-primary" style={{ fontSize: 13 }}
                onClick={() => window.open("https://dashboard.stripe.com", "_blank")}
              >
                <ExternalLink size={14} /> Ouvrir Stripe
              </button>
            </div>
          </div>
        </motion.div>

        {/* KPIs */}
        <div className="adm-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {kpis.map((k, i) => {
            const Icon = k.icon;
            return (
              <motion.div
                key={k.label}
                className="adm-kpi"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className={`adm-kpi-icon ${k.color}`}><Icon size={18} /></div>
                <div className="adm-kpi-value">{k.value}</div>
                <div className="adm-kpi-label">{k.label}</div>
                <div className={`adm-kpi-trend ${k.trend}`}>{k.trendLabel}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Table + Pie */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 20 }}>

          {/* Table */}
          <motion.div
            className="adm-card"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="adm-card-header">
              <span className="adm-card-title">Abonnements récents</span>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Plan</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Prochain prélèvement</th>
                    <th>ID Stripe</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBS.map((s, i) => {
                    const planStyle = PLAN_COLORS[s.plan] ?? PLAN_COLORS.Free;
                    return (
                      <motion.tr key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 * i }}>
                        <td>{s.customer}</td>
                        <td>
                          <span style={{
                            background: planStyle.bg, color: planStyle.color,
                            borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600,
                          }}>{s.plan}</span>
                        </td>
                        <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#fff" }}>{s.amount}</td>
                        <td><span className={`adm-badge ${STATUS_MAP[s.status] ?? "draft"}`}>{STATUS_LABELS[s.status] ?? s.status}</span></td>
                        <td style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{s.next}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{s.id}</td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Pie chart */}
          <motion.div
            className="adm-card"
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="adm-card-header">
              <span className="adm-card-title">Répartition plans</span>
            </div>
            <div style={{ padding: "20px 16px" }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={PLAN_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3}>
                    {PLAN_DATA.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                {PLAN_DATA.map((p) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, color: "rgba(255,255,255,0.7)" }}>{p.name}</span>
                    <span style={{ fontWeight: 600, color: "#fff" }}>{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
}
