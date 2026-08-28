import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, CheckCheck, Mail, MessageCircle, ExternalLink, Filter } from "lucide-react";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";
import { notifyNotificationsChanged } from "@/lib/notification-bus";

export const Route = createFileRoute("/admin/notifications")({
  ssr: false,
  component: NotificationsPage,
});

type Delivery = { channel: string; status: string; error_message: string | null; sent_at: string | null };
type Notif = {
  id: string;
  kind: string;
  subject: string;
  summary: string | null;
  link: string | null;
  entity_type: string | null;
  entity_id?: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  data?: Record<string, unknown> | null;
  deliveries: Delivery[];
};

// Libellés lisibles pour le détail des notifications (aucune donnée n'est masquée :
// les clés inconnues restent affichées telles quelles).
const FIELD_LABEL: Record<string, string> = {
  patient_name: "Visiteur",
  patient_email: "Email",
  patient_phone: "Téléphone",
  appointment_date: "Date du rendez-vous",
  appointment_time: "Heure",
  status: "Statut",
  notes: "Notes",
  therapist_name: "Thérapeute",
  therapist_email: "Email thérapeute",
  therapist_slug: "Profil",
  source: "Source",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  completed: "Terminée",
};

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "status") return STATUS_LABEL[String(value)] ?? String(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function NotifDetails({ n }: { n: Notif }) {
  const entries = Object.entries(n.data ?? {}).filter(([, v]) => v !== null && v !== "");
  if (entries.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>
        Aucun détail enregistré pour cette notification (créée avant l'ajout des détails).
      </div>
    );
  }
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(120px, max-content) 1fr",
        gap: "6px 14px",
        margin: 0,
        fontSize: 13,
      }}
    >
      {entries.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <dt style={{ color: "rgba(255,255,255,0.5)" }}>{FIELD_LABEL[k] ?? k}</dt>
          <dd style={{ margin: 0, color: "#fff", wordBreak: "break-word" }}>
            {k === "patient_email" || k === "therapist_email" ? (
              <a href={`mailto:${String(v)}`} style={{ color: "#5cc8fa" }}>{String(v)}</a>
            ) : k === "patient_phone" ? (
              <a href={`tel:${String(v).replace(/\s/g, "")}`} style={{ color: "#5cc8fa" }}>{String(v)}</a>
            ) : k === "therapist_slug" ? (
              <a href={`/fr/therapeute/${String(v)}`} target="_blank" rel="noreferrer" style={{ color: "#5cc8fa" }}>
                /fr/therapeute/{String(v)}
              </a>
            ) : (
              formatValue(k, v)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const KIND_LABEL: Record<string, string> = {
  therapist_pending: "Thérapeute",
  waitlist_new: "Liste d'attente",
  review_new: "Avis",
  event_pending: "Événement",
  appointment_new: "Réservation",
  article_pending: "Article",
  intake_submission: "Intake",
  contact_message: "Contact",
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return `il y a ${Math.floor(s / 86400)} j`;
}

function NotificationsPage() {
  const load = useServerFn(listNotifications);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);

  const [rows, setRows] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [kind, setKind] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await load({ data: { filter, kind: kind || undefined, limit: 100 } });
      setRows(r.rows as Notif[]);
    } finally {
      setLoading(false);
    }
  }, [load, filter, kind]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Consulter la rubrique = les notifications sont lues. Le badge rouge doit
  // disparaître sans avoir à cliquer chaque ligne (demande explicite).
  useEffect(() => {
    let alive = true;
    const timer = window.setTimeout(async () => {
      try {
        await markAll();
      } catch {
        /* silencieux */
      }
      if (!alive) return;
      setRows((rs) => rs.map((r) => (r.is_read ? r : { ...r, is_read: true, read_at: new Date().toISOString() })));
      notifyNotificationsChanged();
    }, 1200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [markAll]);

  const onMarkOne = useCallback(
    async (id: string) => {
      // Optimiste : l'UI se met à jour tout de suite, le serveur persiste ensuite.
      setRows((rs) =>
        filter === "unread"
          ? rs.filter((r) => r.id !== id)
          : rs.map((r) => (r.id === id ? { ...r, is_read: true, read_at: new Date().toISOString() } : r)),
      );
      notifyNotificationsChanged();
      try {
        await markOne({ data: { id } });
      } finally {
        notifyNotificationsChanged();
      }
    },
    [markOne, filter],
  );

  const onMarkAll = async () => {
    setRows((rs) => (filter === "unread" ? [] : rs.map((r) => ({ ...r, is_read: true }))));
    notifyNotificationsChanged();
    try {
      await markAll();
    } finally {
      notifyNotificationsChanged();
    }
  };

  // Ouvrir une notification (clic sur la carte ou sur « Ouvrir ») = elle est lue.
  const onOpen = (n: Notif) => {
    if (!n.is_read) void onMarkOne(n.id);
  };

  const kinds = Array.from(new Set(rows.map((r) => r.kind)));

  return (
    <div style={{ padding: "32px 24px", color: "#e9d8ff", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Bell size={22} style={{ color: "#b86ef9" }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#fff", margin: 0 }}>Centre de notifications</h1>
        <button
          onClick={onMarkAll}
          style={{
            marginLeft: "auto",
            background: "linear-gradient(135deg,#b86ef9,#5cc8fa)",
            color: "#fff",
            border: "none",
            padding: "8px 14px",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
          }}
        >
          <CheckCheck size={16} /> Tout marquer comme lu
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <Filter size={16} style={{ opacity: 0.6 }} />
        <button
          onClick={() => setFilter("all")}
          style={pillStyle(filter === "all")}
        >Toutes</button>
        <button
          onClick={() => setFilter("unread")}
          style={pillStyle(filter === "unread")}
        >Non lues</button>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          style={{
            marginLeft: 8,
            background: "rgba(255,255,255,0.05)",
            color: "#e9d8ff",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 13,
          }}
        >
          <option value="">Tous types</option>
          {kinds.map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>
          ))}
        </select>
      </div>

      {loading && <p style={{ color: "rgba(255,255,255,0.6)" }}>Chargement…</p>}

      {!loading && rows.length === 0 && (
        <div
          style={{
            padding: 40,
            border: "1px dashed rgba(255,255,255,0.15)",
            borderRadius: 12,
            textAlign: "center",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          Aucune notification pour l'instant.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((n) => (
          <div
            key={n.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(n)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(n);
              }
            }}
            style={{
              background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(184,110,249,0.08)",
              border: `1px solid ${n.is_read ? "rgba(255,255,255,0.06)" : "rgba(184,110,249,0.25)"}`,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                marginTop: 8,
                background: n.is_read ? "transparent" : "#b86ef9",
                boxShadow: n.is_read ? "none" : "0 0 8px #b86ef9",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.05em",
                    color: "#b86ef9",
                    background: "rgba(184,110,249,0.12)",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontWeight: 600,
                    textTransform: "uppercase",
                  }}
                >
                  {KIND_LABEL[n.kind] ?? n.kind}
                </span>
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>{timeAgo(n.created_at)}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{n.subject}</div>
              {n.summary && (
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>{n.summary}</div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIds((s) => ({ ...s, [n.id]: !s[n.id] }));
                }}
                aria-expanded={!!openIds[n.id]}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.7)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 12,
                  cursor: "pointer",
                  marginBottom: 8,
                }}
              >
                {openIds[n.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {openIds[n.id] ? "Masquer les détails" : "Voir les détails"}
              </button>
              {openIds[n.id] && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <NotifDetails n={n} />
                </div>
              )}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {n.deliveries.map((d, i) => (
                  <span
                    key={i}
                    title={d.error_message ?? undefined}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      color: d.status === "sent" ? "#5cc8fa" : "#f87171",
                      background: d.status === "sent" ? "rgba(92,200,250,0.1)" : "rgba(248,113,113,0.1)",
                      padding: "2px 8px",
                      borderRadius: 999,
                    }}
                  >
                    {d.channel === "email" ? <Mail size={11} /> : <MessageCircle size={11} />}
                    {d.channel} · {d.status}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {n.link && (
                <a
                  href={n.link}
                  onClick={() => onOpen(n)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: "#5cc8fa",
                    textDecoration: "none",
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(92,200,250,0.08)",
                  }}
                >
                  Ouvrir <ExternalLink size={12} />
                </a>
              )}
              {!n.is_read && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void onMarkOne(n.id);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    background: "transparent",
                    color: "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    padding: "6px 10px",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  <Check size={12} /> Lu
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "rgba(184,110,249,0.2)" : "transparent",
    color: active ? "#fff" : "rgba(255,255,255,0.6)",
    border: `1px solid ${active ? "rgba(184,110,249,0.4)" : "rgba(255,255,255,0.1)"}`,
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
}