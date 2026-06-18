import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search, Users, TrendingUp, Crown, BellRing, Plus, X, Send,
  CheckCircle2, Circle, Clock, AlertTriangle, LayoutGrid, List as ListIcon, CheckSquare, BellRing as BellRingIcon,
} from "lucide-react";
import {
  listCrmLeads, getCrmAdminOverview, getCrmLeadDetail,
  updateCrmLeadStatus, addCrmNote, createCrmLead, listAdminTasks,
  completeCrmTask, createCrmTask, type CrmLead,
} from "@/lib/crm.functions";
import { LeadsListView, TasksCenter, RelancesCenter } from "@/components/crm/AdminCrmViews";

export const Route = createFileRoute("/admin/crm")({
  component: AdminCrmPage,
});

const STATUS_COLUMNS: Array<{ id: CrmLead["status"]; label: string; color: string }> = [
  { id: "new",        label: "Nouveau lead",  color: "#5cc8fa" },
  { id: "pending",    label: "En attente",    color: "#facc15" },
  { id: "contacted",  label: "Contacté",      color: "#a78bfa" },
  { id: "followup",   label: "Relancé",       color: "#fb923c" },
  { id: "converted",  label: "Inscrit",       color: "#34d399" },
  { id: "elite_pro",  label: "Elite Pro",     color: "#f472b6" },
  { id: "suspended",  label: "Suspendu",      color: "#94a3b8" },
];

const PRIORITY_LABEL: Record<string, { label: string; color: string }> = {
  high:   { label: "Haute",   color: "#ef4444" },
  normal: { label: "Normale", color: "#a78bfa" },
  low:    { label: "Basse",   color: "#64748b" },
};

function Card(props: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      backdropFilter: "blur(8px)",
      padding: 18,
      ...props.style,
    }}>{props.children}</div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: typeof Users; label: string; value: string | number; accent: string }) {
  return (
    <Card style={{ minWidth: 160, flex: "1 1 160px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#cbd5e1", fontSize: 12 }}>
        <Icon size={16} style={{ color: accent }} aria-hidden /> {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: "white", marginTop: 6 }}>{value}</div>
    </Card>
  );
}

function AdminCrmPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCrmLeads);
  const overviewFn = useServerFn(getCrmAdminOverview);
  const detailFn = useServerFn(getCrmLeadDetail);
  const tasksFn = useServerFn(listAdminTasks);
  const updateStatus = useServerFn(updateCrmLeadStatus);
  const addNote = useServerFn(addCrmNote);
  const createLead = useServerFn(createCrmLead);
  const toggleTask = useServerFn(completeCrmTask);
  const addTask = useServerFn(createCrmTask);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  const [cantonFilter, setCantonFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [tab, setTab] = useState<"pipeline" | "list" | "tasks" | "relances">("pipeline");

  const overview = useQuery({
    queryKey: ["crm","overview"],
    queryFn: () => overviewFn(),
  });

  const leadsQ = useQuery({
    queryKey: ["crm","leads", debounced, cantonFilter, sourceFilter],
    queryFn: () => listFn({ data: { search: debounced, canton: cantonFilter || undefined, source: sourceFilter || undefined } }),
  });

  const tasksQ = useQuery({
    queryKey: ["crm","admin-tasks"],
    queryFn: () => tasksFn(),
    refetchInterval: 60_000,
  });

  const detailQ = useQuery({
    queryKey: ["crm","lead", openLeadId],
    queryFn: () => detailFn({ data: { id: openLeadId! } }),
    enabled: !!openLeadId,
  });

  const moveMut = useMutation({
    mutationFn: (v: { id: string; status: CrmLead["status"] }) => updateStatus({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm","leads"] });
      qc.invalidateQueries({ queryKey: ["crm","overview"] });
      if (openLeadId) qc.invalidateQueries({ queryKey: ["crm","lead", openLeadId] });
      toast.success("Statut mis à jour");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, CrmLead[]>();
    STATUS_COLUMNS.forEach((c) => map.set(c.id, []));
    (leadsQ.data ?? []).forEach((l) => map.get(l.status)?.push(l));
    return map;
  }, [leadsQ.data]);

  return (
    <div style={{ padding: "24px 28px", color: "white", maxWidth: 1600, margin: "0 auto" }}>
      {/* Header */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(135deg,#b86ef9,#5cc8fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              CRM Holiswiss
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Pilotage des leads, conversions et relances thérapeutes.</p>
          </div>
          <button
            onClick={() => setShowNewLead(true)}
            aria-label="Créer un lead"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px",
              minHeight: 44, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)",
              background: "linear-gradient(135deg,#7c3aed,#5cc8fa)", color: "white", fontWeight: 600,
              cursor: "pointer", fontSize: 14,
            }}
          >
            <Plus size={16} aria-hidden /> Nouveau lead
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 16 }}>
          <Kpi icon={Users}      label="Leads (total)"        value={overview.data?.leadsTotal ?? "—"} accent="#5cc8fa" />
          <Kpi icon={TrendingUp} label="Nouveaux 30j"         value={overview.data?.leadsLast30 ?? "—"} accent="#a78bfa" />
          <Kpi icon={CheckCircle2} label="Taux conversion"    value={overview.data ? `${overview.data.conversionRate}%` : "—"} accent="#34d399" />
          <Kpi icon={Crown}      label="Elite Pro actifs"     value={overview.data?.elitePro ?? "—"} accent="#f472b6" />
          <Kpi icon={BellRing}   label="Tâches en retard"     value={overview.data?.overdueTasks ?? "—"} accent="#ef4444" />
        </div>

        {/* Search + filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 420 }}>
            <Search size={16} aria-hidden style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="search"
              placeholder="Rechercher un lead (nom, email, spécialité)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Recherche globale CRM"
              style={{
                width: "100%", padding: "10px 12px 10px 36px", minHeight: 44, borderRadius: 12,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "white", fontSize: 14, outline: "none",
              }}
            />
          </div>
          <input
            placeholder="Canton"
            value={cantonFilter}
            onChange={(e) => setCantonFilter(e.target.value)}
            aria-label="Filtrer par canton"
            style={{ minHeight: 44, borderRadius: 12, padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14, width: 140 }}
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            aria-label="Filtrer par source"
            style={{ minHeight: 44, borderRadius: 12, padding: "10px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14 }}
          >
            <option value="">Toutes sources</option>
            <option value="manual">Manuel</option>
            <option value="form">Formulaire</option>
            <option value="landing">Landing</option>
            <option value="import">Import</option>
          </select>
        </div>

        {/* Onglets de vues */}
        <nav aria-label="Vues CRM" style={{
          display: "inline-flex", gap: 4, padding: 4, marginTop: 16,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
        }}>
          {([
            { id: "pipeline", label: "Pipeline", icon: LayoutGrid },
            { id: "list",     label: "Liste",    icon: ListIcon },
            { id: "tasks",    label: "Tâches",   icon: CheckSquare },
            { id: "relances", label: "Relances", icon: BellRingIcon },
          ] as const).map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-pressed={active}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", minHeight: 36, borderRadius: 8,
                  border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: active ? "linear-gradient(135deg,#7c3aed,#5cc8fa)" : "transparent",
                  color: active ? "white" : "#cbd5e1",
                  transition: "background 160ms ease",
                }}
              >
                <Icon size={14} aria-hidden /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main : vue active + sidebar tâches (sauf si onglet Tâches/Relances dédié) */}
      <div style={{ display: "grid", gridTemplateColumns: tab === "pipeline" ? "minmax(0,1fr) 280px" : "minmax(0,1fr)", gap: 16 }}>
        <section aria-label="Vue CRM active" style={{ overflowX: "auto", minWidth: 0 }}>
        {tab === "pipeline" && (
          <div style={{ display: "flex", gap: 12, minWidth: "fit-content", paddingBottom: 8 }}>
            {STATUS_COLUMNS.map((col) => {
              const items = grouped.get(col.id) ?? [];
              return (
                <div key={col.id} style={{ width: 240, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "0 4px" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", textTransform: "uppercase", letterSpacing: 0.5 }}>{col.label}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>{items.length}</span>
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 14, padding: 8, minHeight: 200, display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <AnimatePresence mode="popLayout">
                      {items.map((lead, idx) => (
                        <motion.button
                          key={lead.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0, transition: { delay: Math.min(idx,6) * 0.04 } }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          onClick={() => setOpenLeadId(lead.id)}
                          aria-label={`Ouvrir la fiche de ${lead.first_name} ${lead.last_name}`}
                          style={{
                            textAlign: "left", background: "rgba(15,10,30,0.7)", border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 10, padding: 10, color: "white", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{lead.first_name} {lead.last_name}</span>
                            <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: `${PRIORITY_LABEL[lead.priority].color}22`, color: PRIORITY_LABEL[lead.priority].color }}>
                              {PRIORITY_LABEL[lead.priority].label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>
                            {lead.canton ?? "—"} · {lead.specialty ?? "Spécialité ?"}
                          </div>
                          {lead.last_contact_at && (
                            <div style={{ fontSize: 10, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}>
                              <Clock size={10} aria-hidden /> {new Date(lead.last_contact_at).toLocaleDateString("fr-CH")}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                            {STATUS_COLUMNS.filter((c) => c.id !== lead.status).slice(0, 3).map((c) => (
                              <span
                                key={c.id}
                                role="button"
                                tabIndex={0}
                                aria-label={`Déplacer vers ${c.label}`}
                                onClick={(e) => { e.stopPropagation(); moveMut.mutate({ id: lead.id, status: c.id }); }}
                                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); moveMut.mutate({ id: lead.id, status: c.id }); } }}
                                style={{ fontSize: 9, padding: "2px 5px", borderRadius: 4, background: `${c.color}22`, color: c.color, cursor: "pointer" }}
                              >
                                → {c.label}
                              </span>
                            ))}
                          </div>
                        </motion.button>
                      ))}
                    </AnimatePresence>
                    {items.length === 0 && (
                      <div style={{ fontSize: 11, color: "#64748b", padding: 12, textAlign: "center" }}>Aucun lead</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "list" && <LeadsListView leads={leadsQ.data ?? []} onOpen={(id) => setOpenLeadId(id)} />}
        {tab === "tasks" && <TasksCenter />}
        {tab === "relances" && <RelancesCenter onOpen={(id) => setOpenLeadId(id)} />}
        </section>

        {/* Sidebar tâches */}
        {tab === "pipeline" && (
        <aside aria-label="Tâches admin">
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>Mes tâches</h2>
              <button
                onClick={async () => {
                  const title = window.prompt("Titre de la tâche");
                  if (!title) return;
                  await addTask({ data: { title } });
                  qc.invalidateQueries({ queryKey: ["crm","admin-tasks"] });
                  toast.success("Tâche créée");
                }}
                aria-label="Ajouter une tâche"
                style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "white", borderRadius: 8, width: 28, height: 28, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                <Plus size={14} aria-hidden />
              </button>
            </div>
            {tasksQ.data && tasksQ.data.length > 0 ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                {tasksQ.data.map((t) => {
                  const overdue = !t.done_at && t.due_at && new Date(t.due_at) < new Date();
                  return (
                    <li key={t.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: 8, borderRadius: 10, background: overdue ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.03)" }}>
                      <button
                        onClick={async () => { await toggleTask({ data: { id: t.id, done: !t.done_at } }); qc.invalidateQueries({ queryKey: ["crm","admin-tasks"] }); }}
                        aria-label={t.done_at ? "Rouvrir la tâche" : "Marquer comme faite"}
                        style={{ background: "transparent", border: "none", color: t.done_at ? "#34d399" : "#94a3b8", cursor: "pointer", padding: 2 }}
                      >
                        {t.done_at ? <CheckCircle2 size={16} aria-hidden /> : <Circle size={16} aria-hidden />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: t.done_at ? "#64748b" : "white", textDecoration: t.done_at ? "line-through" : undefined }}>{t.title}</div>
                        {t.due_at && (
                          <div style={{ fontSize: 10, color: overdue ? "#ef4444" : "#94a3b8", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            {overdue && <AlertTriangle size={10} aria-hidden />} {new Date(t.due_at).toLocaleDateString("fr-CH")}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Aucune tâche en cours.</p>
            )}
          </Card>
        </aside>
        )}
      </div>

      {/* Drawer fiche lead */}
      <AnimatePresence>
        {openLeadId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpenLeadId(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50 }}
          >
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog" aria-label="Fiche lead"
              style={{
                position: "absolute", top: 0, right: 0, bottom: 0, width: "min(520px, 100%)",
                background: "#0d0820", borderLeft: "1px solid rgba(255,255,255,0.08)",
                padding: 20, overflowY: "auto", color: "white",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Fiche lead</h3>
                <button onClick={() => setOpenLeadId(null)} aria-label="Fermer" style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}>
                  <X size={18} aria-hidden />
                </button>
              </div>
              {detailQ.isLoading && <p style={{ color: "#94a3b8" }}>Chargement…</p>}
              {detailQ.data?.lead && (
                <LeadDetailContent
                  lead={detailQ.data.lead}
                  activities={detailQ.data.activities}
                  onChangeStatus={(status) => moveMut.mutate({ id: detailQ.data!.lead!.id, status })}
                  onAddNote={async (body) => {
                    await addNote({ data: { entityType: "lead", entityId: detailQ.data!.lead!.id, body } });
                    qc.invalidateQueries({ queryKey: ["crm","lead", openLeadId] });
                    toast.success("Note ajoutée");
                  }}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New lead modal */}
      <AnimatePresence>
        {showNewLead && (
          <NewLeadModal
            onClose={() => setShowNewLead(false)}
            onCreate={async (payload) => {
              await createLead({ data: payload });
              qc.invalidateQueries({ queryKey: ["crm","leads"] });
              qc.invalidateQueries({ queryKey: ["crm","overview"] });
              toast.success("Lead créé");
              setShowNewLead(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LeadDetailContent({
  lead, activities, onChangeStatus, onAddNote,
}: {
  lead: CrmLead;
  activities: Array<{ id: string; type: string; title: string; body: string | null; occurred_at: string }>;
  onChangeStatus: (s: CrmLead["status"]) => void;
  onAddNote: (body: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{lead.first_name} {lead.last_name}</div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          {lead.email ?? "—"} {lead.phone ? ` · ${lead.phone}` : ""}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          {lead.canton ?? "—"} · {lead.specialty ?? "—"} · Source : {lead.source}
        </div>
      </div>

      <div>
        <label htmlFor="lead-status" style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Statut</label>
        <select
          id="lead-status"
          value={lead.status}
          onChange={(e) => onChangeStatus(e.target.value as CrmLead["status"])}
          style={{ width: "100%", minHeight: 44, padding: "10px 12px", borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 14 }}
        >
          {STATUS_COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="lead-note" style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>Ajouter une note</label>
        <textarea
          id="lead-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          style={{ width: "100%", padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 13, resize: "vertical" }}
        />
        <button
          disabled={!note.trim() || sending}
          onClick={async () => { setSending(true); try { await onAddNote(note.trim()); setNote(""); } finally { setSending(false); } }}
          style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", minHeight: 44, borderRadius: 10, background: "rgba(124,58,237,0.3)", border: "1px solid rgba(124,58,237,0.6)", color: "white", cursor: note.trim() && !sending ? "pointer" : "not-allowed", opacity: note.trim() && !sending ? 1 : 0.5, fontSize: 13 }}
        >
          <Send size={14} aria-hidden /> Enregistrer
        </button>
      </div>

      <div>
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Timeline</div>
        {activities.length === 0 ? (
          <p style={{ color: "#64748b", fontSize: 12 }}>Aucune activité enregistrée.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {activities.map((a) => (
              <li key={a.id} style={{ borderLeft: "2px solid rgba(124,58,237,0.5)", paddingLeft: 12 }}>
                <div style={{ fontSize: 12, color: "white", fontWeight: 600 }}>{a.title}</div>
                {a.body && <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2, whiteSpace: "pre-wrap" }}>{a.body}</div>}
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                  {new Date(a.occurred_at).toLocaleString("fr-CH")} · {a.type}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function NewLeadModal({ onClose, onCreate }: { onClose: () => void; onCreate: (p: any) => Promise<void> }) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", canton: "", specialty: "",
    source: "manual", priority: "normal" as "low"|"normal"|"high", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const valid = form.first_name.trim() && form.last_name.trim();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <motion.form
        initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid || submitting) return;
          setSubmitting(true);
          try {
            const payload: any = { ...form };
            ["email","phone","canton","specialty","notes"].forEach((k) => { if (!payload[k]) delete payload[k]; });
            await onCreate(payload);
          } finally { setSubmitting(false); }
        }}
        role="dialog" aria-label="Nouveau lead"
        style={{ width: "min(500px, 100%)", background: "#0d0820", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 22, color: "white", display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Nouveau lead</h3>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: 4 }}>
            <X size={18} aria-hidden />
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <FormInput label="Prénom" required value={form.first_name} onChange={(v) => set("first_name", v)} />
          <FormInput label="Nom" required value={form.last_name} onChange={(v) => set("last_name", v)} />
          <FormInput label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
          <FormInput label="Téléphone" value={form.phone} onChange={(v) => set("phone", v)} />
          <FormInput label="Canton" value={form.canton} onChange={(v) => set("canton", v)} />
          <FormInput label="Spécialité" value={form.specialty} onChange={(v) => set("specialty", v)} />
        </div>
        <FormSelect label="Source" value={form.source} onChange={(v) => set("source", v)} options={[
          { v: "manual", l: "Manuel" }, { v: "form", l: "Formulaire" }, { v: "landing", l: "Landing" }, { v: "import", l: "Import" },
        ]} />
        <FormSelect label="Priorité" value={form.priority} onChange={(v) => set("priority", v)} options={[
          { v: "low", l: "Basse" }, { v: "normal", l: "Normale" }, { v: "high", l: "Haute" },
        ]} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button type="button" onClick={onClose} style={{ padding: "10px 16px", minHeight: 44, borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "white", cursor: "pointer", fontSize: 13 }}>Annuler</button>
          <button type="submit" disabled={!valid || submitting} style={{ padding: "10px 16px", minHeight: 44, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#5cc8fa)", border: "none", color: "white", fontWeight: 600, cursor: valid && !submitting ? "pointer" : "not-allowed", opacity: valid && !submitting ? 1 : 0.5, fontSize: 13 }}>
            Créer
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

function FormInput({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  const id = label.toLowerCase().replace(/\s/g, "-");
  return (
    <div>
      <label htmlFor={id} style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>{label}{required && " *"}</label>
      <input id={id} type={type} value={value} required={required} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", minHeight: 40, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 13 }} />
    </div>
  );
}
function FormSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<{ v: string; l: string }> }) {
  const id = label.toLowerCase().replace(/\s/g, "-");
  return (
    <div>
      <label htmlFor={id} style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 4 }}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", minHeight: 40, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "white", fontSize: 13 }}>
        {options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}