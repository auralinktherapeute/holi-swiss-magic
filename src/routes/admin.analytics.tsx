import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Activity, Users, Clock, Gauge, ChevronRight, Eye, MousePointerClick } from "lucide-react";
import {
  getAnalyticsOverview,
  getTopTherapists,
  getActiveSessionsToday,
} from "@/lib/analytics.functions";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin/analytics")({ component: Page });

type Period = "day" | "week" | "month";
type UserTypeFilter = "all" | "admin" | "moderator" | "therapist" | "user";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois-ci",
};

const USER_TYPE_LABELS: Record<string, string> = {
  admin: "Admin",
  moderator: "Modérateur",
  therapist: "Thérapeute",
  user: "Client",
};

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return "0 min";
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return "à l'instant";
  if (diffH < 24) return `il y a ${Math.round(diffH)} h`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `il y a ${diffD} j`;
  return d.toLocaleDateString("fr-CH", { day: "numeric", month: "short" });
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: any;
  label: string;
  value: string | number;
  color: string;
  delay: number;
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
      <div className="adm-kpi-value">{value}</div>
      <div className="adm-kpi-label">{label}</div>
    </motion.div>
  );
}

function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div className="adm-skeleton" style={{ height: 14, width: 90, borderRadius: 6 }} />
        </td>
      ))}
    </tr>
  );
}

function Page() {
  const [period, setPeriod] = useState<Period>("day");
  const [userType, setUserType] = useState<UserTypeFilter>("all");

  const fetchOverview = useServerFn(getAnalyticsOverview);
  const fetchTopTherapists = useServerFn(getTopTherapists);
  const fetchActiveToday = useServerFn(getActiveSessionsToday);

  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["analytics-overview", period, userType],
    queryFn: () =>
      fetchOverview({
        data: { period, userType: userType === "all" ? undefined : userType },
      }),
    refetchInterval: 60_000,
  });

  const { data: topTherapists, isLoading: loadingTop } = useQuery({
    queryKey: ["analytics-top-therapists", period],
    queryFn: () => fetchTopTherapists({ data: { period: period === "day" ? "week" : period, limit: 10 } }),
  });

  const { data: activeToday, isLoading: loadingActive } = useQuery({
    queryKey: ["analytics-active-today", userType],
    queryFn: () =>
      fetchActiveToday({
        data: { userType: userType === "all" ? undefined : userType, limit: 15 },
      }),
    refetchInterval: 30_000,
  });

  return (
    <div className="adm-root" style={{ minHeight: "100vh", background: "#0f0a1e" }}>
      <div className="adm-page">
        {/* Header */}
        <motion.div
          className="adm-page-header"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div>
            <h1 className="adm-page-title">Analytics</h1>
            <p className="adm-page-subtitle">
              Trafic et activité des utilisateurs connectés · Holiswiss
            </p>
          </div>
        </motion.div>

        {/* Filtres */}
        <div className="adm-toolbar">
          <select
            className="adm-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            aria-label="Période"
          >
            <option value="day">Jour</option>
            <option value="week">Semaine</option>
            <option value="month">Mois</option>
          </select>
          <select
            className="adm-select"
            value={userType}
            onChange={(e) => setUserType(e.target.value as UserTypeFilter)}
            aria-label="Type d'utilisateur"
          >
            <option value="all">Tous les utilisateurs</option>
            <option value="therapist">Thérapeutes</option>
            <option value="user">Clients</option>
            <option value="moderator">Modérateurs</option>
            <option value="admin">Admins</option>
          </select>
        </div>

        {/* KPIs */}
        <div className="adm-kpi-grid">
          <KpiCard
            icon={Users}
            label="Utilisateurs actifs aujourd'hui (DAU)"
            value={loadingOverview ? "—" : overview?.dau ?? 0}
            color="violet"
            delay={0}
          />
          <KpiCard
            icon={Users}
            label="Utilisateurs actifs ce mois (MAU)"
            value={loadingOverview ? "—" : overview?.mau ?? 0}
            color="cyan"
            delay={0.05}
          />
          <KpiCard
            icon={Activity}
            label={`Sessions — ${PERIOD_LABELS[period]}`}
            value={loadingOverview ? "—" : overview?.sessionsInPeriod ?? 0}
            color="green"
            delay={0.1}
          />
          <KpiCard
            icon={Clock}
            label="Durée moyenne de session"
            value={loadingOverview ? "—" : formatDuration(overview?.avgSessionDurationSeconds ?? 0)}
            color="yellow"
            delay={0.15}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
          {/* Thérapeutes les plus consultés */}
          <motion.div
            className="adm-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
          >
            <div className="adm-card-header">
              <span className="adm-card-title">
                <Eye size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Thérapeutes les plus consultés
              </span>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Thérapeute</th>
                    <th>Vues de profil</th>
                    <th>Clics Réserver</th>
                    <th>Taux de clics</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingTop
                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    : (topTherapists ?? []).map((row, i) => (
                        <motion.tr
                          key={row.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.04 * i }}
                        >
                          <td>
                            {row.slug ? (
                              <Link
                                to="/$lang/therapeute/$slug"
                                params={{ lang: "fr", slug: row.slug }}
                                style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}
                              >
                                {row.firstName} {row.lastName}
                              </Link>
                            ) : (
                              <span style={{ color: "#fff", fontWeight: 600 }}>
                                {row.firstName} {row.lastName}
                              </span>
                            )}
                          </td>
                          <td>{row.viewCount}</td>
                          <td>{row.clickCount}</td>
                          <td>{(row.clickThroughRate * 100).toFixed(0)}%</td>
                        </motion.tr>
                      ))}
                  {!loadingTop && (topTherapists ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="adm-empty">
                          <div className="adm-empty-icon">
                            <MousePointerClick size={24} />
                          </div>
                          <div className="adm-empty-title">Aucune vue de profil</div>
                          <div className="adm-empty-sub">
                            Les statistiques apparaîtront ici dès les premières visites.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Connectés aujourd'hui — répond directement au chiffre DAU ci-dessus */}
          <motion.div
            className="adm-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.35 }}
          >
            <div className="adm-card-header">
              <span className="adm-card-title">
                <Gauge size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                Connectés aujourd'hui
              </span>
              <Link
                to="/admin/therapeutes"
                style={{
                  fontSize: 13,
                  color: "#b86ef9",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Voir les thérapeutes <ChevronRight size={14} />
              </Link>
            </div>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Qui</th>
                    <th>Type</th>
                    <th>Dernière activité</th>
                    <th>Appareil</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingActive
                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
                    : (activeToday ?? []).map((row, i) => (
                        <motion.tr
                          key={row.sessionId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.04 * i }}
                        >
                          <td>
                            {row.therapist?.slug ? (
                              <Link
                                to="/$lang/therapeute/$slug"
                                params={{ lang: "fr", slug: row.therapist.slug }}
                                style={{ color: "#fff", textDecoration: "none", fontWeight: 600 }}
                              >
                                {row.therapist.firstName} {row.therapist.lastName}
                              </Link>
                            ) : (
                              <span style={{ color: "rgba(255,255,255,0.6)" }}>
                                {row.userType === "admin"
                                  ? "Compte admin"
                                  : row.userType === "moderator"
                                    ? "Modérateur"
                                    : "Visiteur connecté"}
                              </span>
                            )}
                          </td>
                          <td>{USER_TYPE_LABELS[row.userType]}</td>
                          <td style={{ whiteSpace: "nowrap" }}>
                            {formatRelativeDate(row.lastSeenAt)}
                            {row.isActive && (
                              <span
                                style={{
                                  marginLeft: 8,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: "#22d38a",
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                }}
                              >
                                ● en ligne
                              </span>
                            )}
                          </td>
                          <td style={{ textTransform: "capitalize" }}>{row.deviceType ?? "—"}</td>
                        </motion.tr>
                      ))}
                  {!loadingActive && (activeToday ?? []).length === 0 && (
                    <tr>
                      <td colSpan={4}>
                        <div className="adm-empty">
                          <div className="adm-empty-icon">
                            <Users size={24} />
                          </div>
                          <div className="adm-empty-title">Personne connecté pour l'instant</div>
                          <div className="adm-empty-sub">
                            Cette liste se remplit dès qu'une session s'ouvre aujourd'hui.
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: -8 }}>
          DAU/MAU comptent des sessions actives (pas encore une déduplication stricte par
          utilisateur) — suffisant pour suivre une tendance ; demander une vue SQL dédiée si un
          compte exact devient nécessaire.
        </p>
      </div>
    </div>
  );
}
