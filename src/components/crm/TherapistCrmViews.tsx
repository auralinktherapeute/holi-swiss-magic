import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Circle, Clock, Tag as TagIcon, User } from "lucide-react";
import {
  listMyReminders, listMyRecentNotes, getMySegmentation, completeContactTask,
} from "@/lib/crm-therapist.functions";

const RELATION_LABELS: Record<string, { label: string; color: string }> = {
  prospect: { label: "Prospect", color: "#5cc8fa" },
  new: { label: "Nouveau", color: "#a78bfa" },
  nouveau_client: { label: "Nouveau client", color: "#a78bfa" },
  active: { label: "Actif", color: "#34d399" },
  client_actif: { label: "Actif", color: "#34d399" },
  followup: { label: "À relancer", color: "#fb923c" },
  a_relancer: { label: "À relancer", color: "#fb923c" },
  inactive: { label: "Inactif", color: "#94a3b8" },
  inactif: { label: "Inactif", color: "#94a3b8" },
};
const PRIO_COLOR: Record<string, string> = { high: "#ef4444", normal: "#a78bfa", low: "#64748b" };

const surface: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 14,
  padding: 16,
};

/* ---------------- RAPPELS ---------------- */
export function RemindersView({ onOpenContact }: { onOpenContact: (id: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyReminders);
  const doneFn = useServerFn(completeContactTask);
  const q = useQuery({ queryKey: ["crm-th","reminders"], queryFn: () => listFn({ data: {} }) });

  if (q.isLoading) return <div style={{ color: "var(--muted-foreground)" }}>Chargement…</div>;
  if (!q.data?.length) return <div style={{ ...surface, textAlign: "center", color: "var(--muted-foreground)" }}>Aucun rappel en cours.</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
      {q.data.map((t, i) => {
        const overdue = !t.done_at && t.due_at && new Date(t.due_at) < new Date();
        return (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}
            style={{
              ...surface,
              padding: 14,
              borderColor: overdue ? "rgba(239,68,68,0.4)" : "var(--border)",
              background: overdue ? "rgba(239,68,68,0.05)" : "var(--card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <button
                aria-label={t.done_at ? "Rouvrir" : "Marquer comme fait"}
                onClick={async () => {
                  await doneFn({ data: { id: t.id, done: !t.done_at } });
                  qc.invalidateQueries({ queryKey: ["crm-th","reminders"] });
                  toast.success(t.done_at ? "Rappel rouvert" : "Rappel fait");
                }}
                style={{ background: "transparent", border: "none", color: t.done_at ? "#34d399" : "var(--muted-foreground)", cursor: "pointer", padding: 2 }}
              >
                {t.done_at ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: t.done_at ? "var(--muted-foreground)" : "var(--foreground)", fontWeight: 600, fontSize: 13.5, textDecoration: t.done_at ? "line-through" : undefined }}>{t.title}</div>
                {t.description && <div style={{ color: "var(--muted-foreground)", fontSize: 12, marginTop: 4 }}>{t.description}</div>}
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {t.due_at && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: overdue ? "#ef4444" : "var(--muted-foreground)" }}>
                      {overdue ? <AlertTriangle size={11} /> : <Clock size={11} />} {new Date(t.due_at).toLocaleDateString("fr-CH")}
                    </span>
                  )}
                  <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: `${PRIO_COLOR[t.priority]}22`, color: PRIO_COLOR[t.priority], fontWeight: 600 }}>{t.priority}</span>
                  {t.contact && (
                    <button onClick={() => t.entity_id && onOpenContact(t.entity_id as string)}
                      style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 8px", borderRadius: 8, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer" }}>
                      <User size={11} /> {t.contact.first_name} {t.contact.last_name}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ---------------- NOTES PRIVÉES ---------------- */
export function NotesView({ onOpenContact }: { onOpenContact: (id: string) => void }) {
  const listFn = useServerFn(listMyRecentNotes);
  const q = useQuery({ queryKey: ["crm-th","notes"], queryFn: () => listFn() });
  if (q.isLoading) return <div style={{ color: "var(--muted-foreground)" }}>Chargement…</div>;
  if (!q.data?.length) return <div style={{ ...surface, textAlign: "center", color: "var(--muted-foreground)" }}>Aucune note pour l'instant.</div>;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {q.data.map((n, i) => (
        <motion.li
          key={n.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}
          style={{ ...surface, borderLeft: "3px solid var(--primary)" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {new Date(n.occurred_at).toLocaleString("fr-CH")}
            </div>
            {n.contact && n.entity_id && (
              <button onClick={() => onOpenContact(n.entity_id as string)}
                style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "3px 8px", borderRadius: 8, background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)", cursor: "pointer" }}>
                <User size={11} /> {n.contact.first_name} {n.contact.last_name}
              </button>
            )}
          </div>
          {n.body && <div style={{ marginTop: 8, fontSize: 13, color: "var(--foreground)", whiteSpace: "pre-wrap" }}>{n.body}</div>}
        </motion.li>
      ))}
    </ul>
  );
}

/* ---------------- SEGMENTATION ---------------- */
export function SegmentationView() {
  const listFn = useServerFn(getMySegmentation);
  const q = useQuery({ queryKey: ["crm-th","segmentation"], queryFn: () => listFn() });
  if (q.isLoading) return <div style={{ color: "var(--muted-foreground)" }}>Chargement…</div>;
  const d = q.data!;
  const maxStatus = Math.max(1, ...Object.values(d.byStatus));
  const maxTag = Math.max(1, ...Object.values(d.byTag));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
      <div style={surface}>
        <h3 style={h3}>Vue d'ensemble</h3>
        <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
          <Stat label="Contacts" value={d.total} accent="var(--primary)" />
          <Stat label="Actifs 30j" value={d.withRecentBooking} accent="#34d399" />
        </div>
      </div>

      <div style={surface}>
        <h3 style={h3}>Par statut de relation</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {Object.entries(d.byStatus).map(([k, v]) => {
            const meta = RELATION_LABELS[k] ?? { label: k, color: "#94a3b8" };
            return (
              <div key={k}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--foreground)", marginBottom: 4 }}>
                  <span>{meta.label}</span><span style={{ color: "var(--muted-foreground)" }}>{v}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                  <motion.div
                    initial={{ width: 0 }} animate={{ width: `${(v / maxStatus) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ height: "100%", background: meta.color, borderRadius: 999 }}
                  />
                </div>
              </div>
            );
          })}
          {Object.keys(d.byStatus).length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Aucune donnée.</p>}
        </div>
      </div>

      <div style={surface}>
        <h3 style={h3}>Par tag</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {Object.entries(d.byTag)
            .sort(([,a],[,b]) => b - a)
            .map(([k, v]) => (
              <span key={k} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 999,
                background: "var(--muted)", color: "var(--foreground)",
                fontSize: 12, fontWeight: 500,
                opacity: 0.6 + 0.4 * (v / maxTag),
              }}>
                <TagIcon size={11} aria-hidden /> {k}
                <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>· {v}</span>
              </span>
          ))}
          {Object.keys(d.byTag).length === 0 && <p style={{ color: "var(--muted-foreground)", fontSize: 12 }}>Aucun tag utilisé.</p>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700, color: accent }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}
const h3: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "var(--foreground)", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 };