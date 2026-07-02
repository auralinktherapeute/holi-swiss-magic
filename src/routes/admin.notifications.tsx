import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, CheckCheck, Mail, MessageCircle, ExternalLink, Filter } from "lucide-react";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/notifications.functions";

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
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  deliveries: Delivery[];
};

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

  const onMarkOne = async (id: string) => {
    await markOne({ data: { id } });
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, is_read: true } : r)));
  };

  const onMarkAll = async () => {
    await markAll();
    setRows((rs) => rs.map((r) => ({ ...r, is_read: true })));
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
            style={{
              background: n.is_read ? "rgba(255,255,255,0.03)" : "rgba(184,110,249,0.08)",
              border: `1px solid ${n.is_read ? "rgba(255,255,255,0.06)" : "rgba(184,110,249,0.25)"}`,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
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
                  onClick={() => onMarkOne(n.id)}
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