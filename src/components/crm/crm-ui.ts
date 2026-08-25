/** Styles partagés du CRM admin (thème sombre / violet HoliSwiss). */
export const crmCard: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 16,
  backdropFilter: "blur(8px)",
};

export const crmInput: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "white",
  fontSize: 14,
};

export const crmBtn: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 14px",
  borderRadius: 10,
  background: "rgba(124,58,237,0.25)",
  border: "1px solid rgba(124,58,237,0.5)",
  color: "white",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

export const crmBtnGhost: React.CSSProperties = {
  ...crmBtn,
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.15)",
  fontWeight: 500,
};

export const crmBtnDanger: React.CSSProperties = {
  ...crmBtn,
  background: "rgba(239,68,68,0.18)",
  border: "1px solid rgba(239,68,68,0.45)",
  color: "#fecaca",
};

export const crmLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontWeight: 600,
};

export const CRM_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "#5cc8fa" },
  pending: { label: "En attente", color: "#facc15" },
  contacted: { label: "Contacté", color: "#a78bfa" },
  followup: { label: "Relancé", color: "#fb923c" },
  active: { label: "Actif", color: "#34d399" },
  loyal: { label: "Fidélisé", color: "#f472b6" },
  converted: { label: "Inscrit", color: "#34d399" },
  elite_pro: { label: "Elite Pro", color: "#f472b6" },
  suspended: { label: "Suspendu", color: "#94a3b8" },
};

export function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-CH");
}

export function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" });
}

export function healthColor(score: number | null | undefined) {
  if (score == null) return "#64748b";
  if (score >= 75) return "#34d399";
  if (score >= 50) return "#facc15";
  return "#ef4444";
}
