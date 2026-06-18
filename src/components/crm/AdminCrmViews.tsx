import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, Flag, Mail, Phone } from "lucide-react";
import {
  listAdminTasksAll, listAdminRelances, completeCrmTask, createCrmTask,
  updateCrmLeadStatus, type CrmLead, type CrmTask,
} from "@/lib/crm.functions";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new:        { label: "Nouveau",   color: "#5cc8fa" },
  pending:    { label: "En attente",color: "#facc15" },
  contacted:  { label: "Contacté",  color: "#a78bfa" },
  followup:   { label: "Relancé",   color: "#fb923c" },
  converted:  { label: "Inscrit",   color: "#34d399" },
  elite_pro:  { label: "Elite Pro", color: "#f472b6" },
  suspended:  { label: "Suspendu",  color: "#94a3b8" },
};
const PRIO_COLOR: Record<string, string> = { high: "#ef4444", normal: "#a78bfa", low: "#64748b" };

const card: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: 16,
  backdropFilter: "blur(8px)",
};

/* ---------------- LISTE ---------------- */
export function LeadsListView({ leads, onOpen }: { leads: CrmLead[]; onOpen: (id: string) => void }) {
  if (leads.length === 0) {
    return <div style={{ ...card, color: "#94a3b8", textAlign: "center", padding: 32 }}>Aucun lead trouvé.</div>;
  }
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "#e2e8f0" }}>
          <thead style={{ background: "rgba(255,255,255,0.03)" }}>
            <tr>
              {["Lead","Contact","Canton","Spécialité","Statut","Priorité","Source","Maj",""].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 10.5, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((l, i) => {
              const s = STATUS_LABELS[l.status] ?? STATUS_LABELS.new;
              return (
                <motion.tr
                  key={l.id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: Math.min(i, 12) * 0.015 } }}
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
                >
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "white" }}>{l.first_name} {l.last_name}</td>
                  <td style={{ padding: "10px 14px", color: "#cbd5e1" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {l.email && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}><Mail size={11} aria-hidden /> {l.email}</span>}
                      {l.phone && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}><Phone size={11} aria-hidden /> {l.phone}</span>}
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{l.canton ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{l.specialty ?? "—"}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: `${s.color}22`, color: s.color, fontWeight: 600 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: PRIO_COLOR[l.priority] }}>
                      <Flag size={11} aria-hidden /> {l.priority}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>{l.source}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 11 }}>{new Date(l.updated_at).toLocaleDateString("fr-CH")}</td>
                  <td style={{ padding: "10px 14px", textAlign: "right" }}>
                    <button onClick={() => onOpen(l.id)} aria-label={`Ouvrir ${l.first_name}`}
                      style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(124,58,237,0.25)", border: "1px solid rgba(124,58,237,0.5)", color: "white", cursor: "pointer", fontSize: 12 }}>
                      Ouvrir
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- CENTRE DES TÂCHES ---------------- */
export function TasksCenter() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminTasksAll);
  const toggleFn = useServerFn(completeCrmTask);
  const createFn = useServerFn(createCrmTask);
  const [status, setStatus] = useState<"open" | "done" | "overdue" | "">("open");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "">("");

  const q = useQuery({
    queryKey: ["crm","tasks-all", status, priority],
    queryFn: () => listFn({ data: { status: status || undefined, priority: priority || undefined } }),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <select aria-label="Statut" value={status} onChange={(e) => setStatus(e.target.value as any)}
          style={selectStyle}>
          <option value="">Tous statuts</option>
          <option value="open">À faire</option>
          <option value="overdue">En retard</option>
          <option value="done">Terminées</option>
        </select>
        <select aria-label="Priorité" value={priority} onChange={(e) => setPriority(e.target.value as any)} style={selectStyle}>
          <option value="">Toutes priorités</option>
          <option value="high">Haute</option>
          <option value="normal">Normale</option>
          <option value="low">Basse</option>
        </select>
        <button
          onClick={async () => {
            const title = window.prompt("Titre de la tâche");
            if (!title) return;
            await createFn({ data: { title } });
            qc.invalidateQueries({ queryKey: ["crm","tasks-all"] });
            qc.invalidateQueries({ queryKey: ["crm","admin-tasks"] });
            toast.success("Tâche créée");
          }}
          style={{ marginLeft: "auto", padding: "9px 14px", borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#5cc8fa)", color: "white", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          + Nouvelle tâche
        </button>
      </div>

      {q.isLoading && <div style={{ color: "#94a3b8" }}>Chargement…</div>}
      {(q.data ?? []).length === 0 && !q.isLoading && (
        <div style={{ ...card, textAlign: "center", color: "#94a3b8", padding: 32 }}>Aucune tâche.</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {(q.data ?? []).map((t: CrmTask, i: number) => {
          const overdue = !t.done_at && t.due_at && new Date(t.due_at) < new Date();
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}
              style={{
                ...card,
                padding: 14,
                borderColor: overdue ? "rgba(239,68,68,0.35)" : "rgba(255,255,255,0.08)",
                background: overdue ? "rgba(239,68,68,0.06)" : card.background,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <button
                  onClick={async () => {
                    await toggleFn({ data: { id: t.id, done: !t.done_at } });
                    qc.invalidateQueries({ queryKey: ["crm","tasks-all"] });
                    qc.invalidateQueries({ queryKey: ["crm","admin-tasks"] });
                    qc.invalidateQueries({ queryKey: ["crm","overview"] });
                  }}
                  aria-label={t.done_at ? "Rouvrir" : "Marquer comme faite"}
                  style={{ background: "transparent", border: "none", color: t.done_at ? "#34d399" : "#94a3b8", cursor: "pointer", padding: 2 }}
                >
                  {t.done_at ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: t.done_at ? "#64748b" : "white", fontSize: 13.5, fontWeight: 600, textDecoration: t.done_at ? "line-through" : undefined }}>{t.title}</div>
                  {t.description && <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{t.description}</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {t.due_at && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: overdue ? "#ef4444" : "#94a3b8" }}>
                        {overdue ? <AlertTriangle size={11} /> : <Clock size={11} />} {new Date(t.due_at).toLocaleDateString("fr-CH")}
                      </span>
                    )}
                    <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: `${PRIO_COLOR[t.priority]}22`, color: PRIO_COLOR[t.priority], fontWeight: 600 }}>{t.priority}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- CENTRE DE RELANCES ---------------- */
export function RelancesCenter({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdminRelances);
  const updateStatus = useServerFn(updateCrmLeadStatus);

  const q = useQuery({ queryKey: ["crm","relances"], queryFn: () => listFn() });
  const d = q.data;

  const markContacted = async (id: string) => {
    await updateStatus({ data: { id, status: "contacted" } });
    qc.invalidateQueries({ queryKey: ["crm","relances"] });
    qc.invalidateQueries({ queryKey: ["crm","leads"] });
    qc.invalidateQueries({ queryKey: ["crm","overview"] });
    toast.success("Lead marqué comme contacté");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <BucketCard label="Sans contact > 7j"  value={d?.buckets.d7 ?? 0}  color="#facc15" />
        <BucketCard label="Sans contact > 14j" value={d?.buckets.d14 ?? 0} color="#fb923c" />
        <BucketCard label="Sans contact > 30j" value={d?.buckets.d30 ?? 0} color="#ef4444" />
        <BucketCard label="En relance active"  value={d?.followup.length ?? 0} color="#a78bfa" />
      </div>

      <section>
        <h2 style={sectionTitle}>À relancer en priorité</h2>
        <RelanceList leads={d?.staleLeads ?? []} onOpen={onOpen} onContacted={markContacted} emptyMsg="Aucun lead sans réponse depuis 7 jours." />
      </section>

      <section>
        <h2 style={sectionTitle}>Pipeline “Relancé”</h2>
        <RelanceList leads={d?.followup ?? []} onOpen={onOpen} onContacted={markContacted} emptyMsg="Aucun lead actuellement en relance." />
      </section>
    </div>
  );
}

function BucketCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...card, padding: 14, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: "white", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function RelanceList({ leads, onOpen, onContacted, emptyMsg }: { leads: CrmLead[]; onOpen: (id: string) => void; onContacted: (id: string) => void; emptyMsg: string }) {
  if (leads.length === 0) {
    return <div style={{ ...card, color: "#94a3b8", padding: 18, fontSize: 13 }}>{emptyMsg}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {leads.map((l, i) => {
        const days = Math.floor((Date.now() - new Date(l.last_contact_at ?? l.created_at).getTime()) / 86400_000);
        const tone = days >= 30 ? "#ef4444" : days >= 14 ? "#fb923c" : "#facc15";
        return (
          <motion.div
            key={l.id}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 12) * 0.02 } }}
            style={{ ...card, padding: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ color: "white", fontSize: 13.5, fontWeight: 600 }}>{l.first_name} {l.last_name}</div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>{l.email ?? l.phone ?? "—"} · {l.canton ?? "—"}</div>
            </div>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: `${tone}22`, color: tone, fontWeight: 600, whiteSpace: "nowrap" }}>
              <Clock size={10} aria-hidden style={{ marginRight: 4, verticalAlign: -1 }} />
              {days}j sans contact
            </span>
            <button onClick={() => onContacted(l.id)} style={{ padding: "7px 12px", borderRadius: 8, background: "rgba(52,211,153,0.18)", border: "1px solid rgba(52,211,153,0.45)", color: "#86efac", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              ✓ Contacté
            </button>
            <button onClick={() => onOpen(l.id)} style={{ padding: "7px 12px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "white", cursor: "pointer", fontSize: 12 }}>
              Ouvrir
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  minHeight: 40, padding: "8px 12px", borderRadius: 10,
  background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
  color: "white", fontSize: 13,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: "#e2e8f0",
  textTransform: "uppercase", letterSpacing: 0.6, margin: "4px 0 10px",
};