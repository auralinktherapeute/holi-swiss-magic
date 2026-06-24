import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, LayoutGrid, CheckSquare, FileText, Plus, Pencil, Trash2, X,
  Phone, Mail, Calendar, Tag, ChevronRight, Check, Clock, AlertCircle,
  QrCode, Download, Send, Eye, Settings, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import LogoUploader from "@/components/dashboard/LogoUploader";
import {
  listMyContacts, upsertContact, deleteContact, addContactNote, listContactNotes,
  listMyTasks, upsertTask, deleteTask, type ClientContact, type CrmTask, type ContactNote,
} from "@/lib/crm-therapist.functions";
import {
  listMyInvoices, upsertInvoice, deleteInvoice, updateInvoiceStatus,
  getTherapistBranding, updateTherapistBranding, type Invoice, type InvoiceItem,
} from "@/lib/invoice.functions";

export const Route = createFileRoute("/dashboard/crm")({ component: CrmPage });

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = [
  { id: "prospect",  label: "Prospect",       color: "#5cc8fa", bg: "rgba(92,200,250,0.15)" },
  { id: "new",       label: "Nouveau",         color: "#a78bfa", bg: "rgba(167,139,250,0.15)" },
  { id: "active",    label: "Actif",           color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  { id: "followup",  label: "À relancer",      color: "#fb923c", bg: "rgba(251,146,60,0.15)" },
  { id: "inactive",  label: "Inactif",         color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
] as const;

type StatusId = typeof STATUSES[number]["id"];

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.id, s])) as Record<StatusId, typeof STATUSES[number]>;

const TAG_PRESETS = ["stress", "sommeil", "énergie", "VIP", "fidélisation", "suivi", "sport"];

const PRIORITY_MAP = {
  low:    { label: "Basse",   color: "#94a3b8" },
  normal: { label: "Normale", color: "#a78bfa" },
  high:   { label: "Haute",   color: "#fb923c" },
};

// ── Utils ─────────────────────────────────────────────────────────────────────

function fmt(amount: number, currency = "CHF") {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency }).format(amount);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status as StatusId];
  if (!s) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
      padding: "2px 8px", borderRadius: 99,
      background: s.bg, color: s.color, border: `1px solid ${s.color}40`,
    }}>{s.label}</span>
  );
}

// ── Contact Dialog ────────────────────────────────────────────────────────────

type ContactForm = {
  id?: string; first_name: string; last_name: string; email: string; phone: string;
  session_type: string; relation_status: StatusId; tags: string[];
  private_notes: string; payment_link: string;
};
const EMPTY_CONTACT: ContactForm = {
  first_name: "", last_name: "", email: "", phone: "", session_type: "",
  relation_status: "prospect", tags: [], private_notes: "", payment_link: "",
};

function ContactDialog({ open, onClose, initial, contacts }: {
  open: boolean; onClose: () => void;
  initial?: ClientContact | null; contacts: ClientContact[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ContactForm>(
    initial ? { ...EMPTY_CONTACT, ...initial, email: initial.email ?? "", phone: initial.phone ?? "",
      session_type: initial.session_type ?? "", private_notes: initial.private_notes ?? "",
      payment_link: initial.payment_link ?? "" } : EMPTY_CONTACT
  );
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [noteText, setNoteText] = useState("");

  const notesQ = useQuery({
    queryKey: ["contact-notes", initial?.id],
    queryFn: () => listContactNotes({ data: { contact_id: initial!.id } }),
    enabled: !!initial?.id,
  });

  const saveMut = useMutation({
    mutationFn: () => upsertContact({ data: { ...form, email: form.email || null, phone: form.phone || null } as any }),
    onSuccess: () => { toast.success("Contact sauvegardé"); qc.invalidateQueries({ queryKey: ["crm-contacts"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addNoteMut = useMutation({
    mutationFn: () => addContactNote({ data: { contact_id: initial!.id, content: noteText } }),
    onSuccess: () => { setNoteText(""); qc.invalidateQueries({ queryKey: ["contact-notes", initial?.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof ContactForm, v: any) => setForm(p => ({ ...p, [k]: v }));
  const addTag = (t: string) => { const tag = t.trim().toLowerCase(); if (tag && !form.tags.includes(tag)) set("tags", [...form.tags, tag]); setTagInput(""); };
  const removeTag = (t: string) => set("tags", form.tags.filter(x => x !== t));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-surface border-border/60 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Prénom *</Label><Input value={form.first_name} onChange={e => set("first_name", e.target.value)} className="bg-background border-border/60" /></div>
            <div className="space-y-1"><Label>Nom</Label><Input value={form.last_name} onChange={e => set("last_name", e.target.value)} className="bg-background border-border/60" /></div>
            <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={e => set("email", e.target.value)} type="email" className="bg-background border-border/60" /></div>
            <div className="space-y-1"><Label>Téléphone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} className="bg-background border-border/60" /></div>
            <div className="space-y-1"><Label>Type de séance</Label><Input value={form.session_type} onChange={e => set("session_type", e.target.value)} placeholder="Ex: Reiki, Sophrologie…" className="bg-background border-border/60" /></div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={form.relation_status} onValueChange={v => set("relation_status", v as StatusId)}>
                <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-surface border-border/60">
                  {STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {form.tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary-foreground border border-primary/30">
                  {t}<button type="button" onClick={() => removeTag(t)}><X className="h-2.5 w-2.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag(tagInput))} placeholder="Ajouter un tag…" className="bg-background border-border/60" />
              <Button type="button" variant="outline" size="sm" onClick={() => addTag(tagInput)}>+</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {TAG_PRESETS.filter(t => !form.tags.includes(t)).map(t => (
                <button key={t} type="button" onClick={() => addTag(t)} className="text-xs px-2 py-0.5 rounded-full border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">{t}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Lien de paiement (Stripe, Twint, PayPal…)</Label>
            <Input value={form.payment_link} onChange={e => set("payment_link", e.target.value)} placeholder="https://buy.stripe.com/…" className="bg-background border-border/60" />
          </div>
          <div className="space-y-1">
            <Label>Notes privées</Label>
            <Textarea value={form.private_notes} onChange={e => set("private_notes", e.target.value)} rows={3} className="bg-background border-border/60 resize-none" />
          </div>

          {initial && (
            <div className="space-y-2 border-t border-border/40 pt-3">
              <Label>Notes & historique</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {(notesQ.data ?? []).map(n => (
                  <div key={n.id} className="text-sm bg-background rounded-lg p-2 border border-border/40">
                    <p className="text-foreground">{n.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(n.created_at)}</p>
                  </div>
                ))}
                {(notesQ.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">Aucune note.</p>}
              </div>
              <div className="flex gap-2">
                <Input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === "Enter" && noteText.trim() && addNoteMut.mutate()} placeholder="Ajouter une note…" className="bg-background border-border/60" />
                <Button type="button" size="sm" variant="secondary" onClick={() => noteText.trim() && addNoteMut.mutate()}>Ajouter</Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.first_name.trim()}>
            {saveMut.isPending ? "…" : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Pipeline (Kanban) ─────────────────────────────────────────────────────────

function PipelineTab({ contacts, onEdit }: { contacts: ClientContact[]; onEdit: (c: ClientContact) => void }) {
  const qc = useQueryClient();
  const moveMut = useMutation({
    mutationFn: ({ id, relation_status }: { id: string; relation_status: string }) =>
      upsertContact({ data: { id, relation_status } as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contacts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [dragging, setDragging] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<string, ClientContact[]> = {};
    STATUSES.forEach(s => { map[s.id] = []; });
    contacts.forEach(c => { (map[c.relation_status] ??= []).push(c); });
    return map;
  }, [contacts]);

  const onDrop = (status: string) => {
    if (dragging && dragging !== status) {
      const contact = contacts.find(c => c.id === dragging);
      if (contact) moveMut.mutate({ id: dragging, relation_status: status });
    }
    setDragging(null);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
      {STATUSES.map(col => (
        <div
          key={col.id}
          className="flex-shrink-0 w-56 rounded-xl border border-border/40 bg-surface/60"
          style={{ borderTop: `3px solid ${col.color}` }}
          onDragOver={e => e.preventDefault()}
          onDrop={() => onDrop(col.id)}
        >
          <div className="p-3 border-b border-border/30 flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: col.color }}>{col.label}</span>
            <span className="text-xs text-muted-foreground bg-background rounded-full px-2 py-0.5">{byStatus[col.id]?.length ?? 0}</span>
          </div>
          <div className="p-2 space-y-2">
            {(byStatus[col.id] ?? []).map(c => (
              <div
                key={c.id}
                draggable
                onDragStart={() => setDragging(c.id)}
                onDragEnd={() => setDragging(null)}
                className="bg-background rounded-lg p-2.5 border border-border/40 cursor-grab hover:border-primary/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-1">
                  <p className="text-sm font-medium text-foreground leading-tight">{c.first_name} {c.last_name}</p>
                  <button onClick={() => onEdit(c)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
                {c.session_type && <p className="text-xs text-muted-foreground mt-0.5">{c.session_type}</p>}
                {c.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.tags.slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{t}</span>
                    ))}
                    {c.tags.length > 2 && <span className="text-[10px] text-muted-foreground">+{c.tags.length - 2}</span>}
                  </div>
                )}
                {c.email && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{c.email}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Contacts List ─────────────────────────────────────────────────────────────

function ContactsTab({ contacts, onEdit, onDelete }: {
  contacts: ClientContact[];
  onEdit: (c: ClientContact) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const filtered = useMemo(() => contacts.filter(c => {
    if (filterStatus && c.relation_status !== filterStatus) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return `${c.first_name} ${c.last_name} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(s);
    }
    return true;
  }), [contacts, search, filterStatus]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="bg-surface border-border/60 max-w-xs" />
        <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="bg-surface border-border/60 w-40"><SelectValue placeholder="Tous" /></SelectTrigger>
          <SelectContent className="bg-surface border-border/60">
            <SelectItem value="all">Tous</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {filtered.map(c => (
          <Card key={c.id} className="bg-surface border-border/60 hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {c.first_name[0]}{c.last_name?.[0] ?? ""}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground">{c.first_name} {c.last_name}</p>
                  <StatusBadge status={c.relation_status} />
                  {c.tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-background border border-border/40 text-muted-foreground">{t}</span>)}
                </div>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                  {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                  {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.session_type && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{c.session_type}</span>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => onEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Supprimer ce contact ?")) onDelete(c.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Aucun contact trouvé.</p>}
      </div>
    </div>
  );
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

function TaskDialog({ open, onClose, contacts }: { open: boolean; onClose: () => void; contacts: ClientContact[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", due_at: "", priority: "normal" as "low" | "normal" | "high", contact_id: "" });
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));
  const mut = useMutation({
    mutationFn: () => upsertTask({ data: { ...form, due_at: form.due_at || null, contact_id: form.contact_id || null } as any }),
    onSuccess: () => { toast.success("Tâche créée"); qc.invalidateQueries({ queryKey: ["crm-tasks"] }); onClose(); setForm({ title: "", description: "", due_at: "", priority: "normal", contact_id: "" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-surface border-border/60 max-w-md">
        <DialogHeader><DialogTitle>Nouvelle tâche / relance</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Titre *</Label><Input value={form.title} onChange={e => set("title", e.target.value)} className="bg-background border-border/60" /></div>
          <div className="space-y-1"><Label>Contact lié</Label>
            <Select value={form.contact_id || "none"} onValueChange={v => set("contact_id", v === "none" ? "" : v)}>
              <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Optionnel" /></SelectTrigger>
              <SelectContent className="bg-surface border-border/60">
                <SelectItem value="none">Aucun</SelectItem>
                {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Échéance</Label><Input type="datetime-local" value={form.due_at} onChange={e => set("due_at", e.target.value)} className="bg-background border-border/60" /></div>
            <div className="space-y-1"><Label>Priorité</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-surface border-border/60">
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label>Description</Label><Textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} className="bg-background border-border/60 resize-none" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => mut.mutate()} disabled={mut.isPending || !form.title.trim()}>Créer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TasksTab({ contacts }: { contacts: ClientContact[] }) {
  const qc = useQueryClient();
  const [showDone, setShowDone] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const tasksQ = useQuery({ queryKey: ["crm-tasks", showDone], queryFn: () => listMyTasks({ data: { done: showDone } }) });

  const toggleMut = useMutation({
    mutationFn: (t: CrmTask) => upsertTask({ data: { ...t, done: !t.done, contact_id: t.contact_id || null } as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-tasks"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const tasks = (tasksQ.data ?? []) as any[];
  const overdue = tasks.filter(t => !t.done && t.due_at && new Date(t.due_at) < new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant={!showDone ? "default" : "outline"} className={!showDone ? "bg-primary" : ""} onClick={() => setShowDone(false)}>En cours</Button>
          <Button size="sm" variant={showDone ? "default" : "outline"} className={showDone ? "bg-primary" : ""} onClick={() => setShowDone(true)}>Terminées</Button>
        </div>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setNewTask(true)}>
          <Plus className="h-4 w-4 mr-1" />Tâche
        </Button>
      </div>

      {overdue.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{overdue.length} tâche{overdue.length > 1 ? "s" : ""} en retard</p>
        </div>
      )}

      <div className="space-y-2">
        {tasks.map((t: any) => {
          const isLate = !t.done && t.due_at && new Date(t.due_at) < new Date();
          const contactName = t.crm_client_contacts ? `${t.crm_client_contacts.first_name} ${t.crm_client_contacts.last_name}` : null;
          return (
            <Card key={t.id} className={`border-border/60 transition-colors ${t.done ? "bg-surface/40 opacity-60" : "bg-surface"}`}>
              <CardContent className="p-3 flex items-start gap-3">
                <button onClick={() => toggleMut.mutate(t)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  {t.done ? <Check className="h-4 w-4 text-green-400" /> : <div className="h-4 w-4 rounded border-2 border-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-medium ${t.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{ color: PRIORITY_MAP[t.priority as keyof typeof PRIORITY_MAP]?.color, borderColor: `${PRIORITY_MAP[t.priority as keyof typeof PRIORITY_MAP]?.color}50` }}>
                      {PRIORITY_MAP[t.priority as keyof typeof PRIORITY_MAP]?.label}
                    </span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    {contactName && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{contactName}</span>}
                    {t.due_at && <span className={`flex items-center gap-1 ${isLate ? "text-destructive" : ""}`}><Clock className="h-3 w-3" />{fmtDate(t.due_at)}</span>}
                  </div>
                  {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                </div>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive shrink-0" onClick={() => { if (confirm("Supprimer ?")) delMut.mutate(t.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {tasks.length === 0 && <p className="text-center text-muted-foreground py-10">{showDone ? "Aucune tâche terminée." : "Aucune tâche en cours. Bien joué ! 🎉"}</p>}
      </div>

      <TaskDialog open={newTask} onClose={() => setNewTask(false)} contacts={contacts} />
    </div>
  );
}

// ── Invoice ───────────────────────────────────────────────────────────────────

function QRCodeDisplay({ url }: { url: string }) {
  const size = 140;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a0a2e`;
  return (
    <div className="flex flex-col items-center gap-2">
      <img src={qrUrl} alt="QR code paiement" width={size} height={size} className="rounded-lg border border-border/40" />
      <p className="text-xs text-muted-foreground text-center max-w-[140px] break-all">{url.length > 40 ? url.slice(0, 40) + "…" : url}</p>
    </div>
  );
}

type InvoiceForm = {
  id?: string; contact_id: string; client_name: string; client_address: string;
  status: "draft" | "sent" | "paid" | "cancelled";
  issued_at: string; due_at: string; notes: string; payment_link: string; currency: string;
  items: { description: string; quantity: number; unit_price: number }[];
};

const EMPTY_INV: InvoiceForm = {
  client_name: "", client_address: "", contact_id: "", status: "draft",
  issued_at: new Date().toISOString().slice(0, 10), due_at: "", notes: "", payment_link: "", currency: "CHF",
  items: [{ description: "", quantity: 1, unit_price: 0 }],
};

function InvoiceDialog({ open, onClose, initial, contacts, branding }: {
  open: boolean; onClose: () => void;
  initial?: Invoice | null; contacts: ClientContact[];
  branding: any;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<InvoiceForm>(
    initial
      ? { ...EMPTY_INV, ...initial, contact_id: initial.contact_id ?? "", due_at: initial.due_at ?? "", client_address: initial.client_address ?? "", notes: initial.notes ?? "", payment_link: initial.payment_link ?? "", items: initial.invoice_items?.map(i => ({ description: i.description, quantity: i.quantity, unit_price: i.unit_price })) ?? EMPTY_INV.items }
      : { ...EMPTY_INV, payment_link: branding?.payment_link ?? "" }
  );
  const [preview, setPreview] = useState(false);

  const set = (k: keyof InvoiceForm, v: any) => setForm(p => ({ ...p, [k]: v }));
  const setItem = (i: number, k: string, v: any) => setForm(p => ({
    ...p, items: p.items.map((it, idx) => idx === i ? { ...it, [k]: v } : it),
  }));
  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { description: "", quantity: 1, unit_price: 0 }] }));
  const removeItem = (i: number) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const total = form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);

  const mut = useMutation({
    mutationFn: () => upsertInvoice({ data: { ...form, contact_id: form.contact_id || null, due_at: form.due_at || null, items: form.items as any } as any }),
    onSuccess: () => { toast.success("Facture sauvegardée"); qc.invalidateQueries({ queryKey: ["invoices"] }); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-surface border-border/60 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{initial ? `Facture ${initial.invoice_number}` : "Nouvelle facture"}</DialogTitle>
            <Button size="sm" variant="outline" onClick={() => setPreview(p => !p)}>
              <Eye className="h-4 w-4 mr-1" />{preview ? "Éditer" : "Aperçu"}
            </Button>
          </div>
        </DialogHeader>

        {preview ? (
          <InvoicePreview form={form} total={total} branding={branding} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Client *</Label>
                <Select value={form.contact_id || "manual"} onValueChange={v => {
                  if (v === "manual") { set("contact_id", ""); return; }
                  const c = contacts.find(x => x.id === v);
                  if (c) { set("contact_id", v); set("client_name", `${c.first_name} ${c.last_name}`); }
                }}>
                  <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent className="bg-surface border-border/60">
                    <SelectItem value="manual">Saisie manuelle</SelectItem>
                    {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label>Nom client *</Label><Input value={form.client_name} onChange={e => set("client_name", e.target.value)} className="bg-background border-border/60" /></div>
              <div className="space-y-1"><Label>Date d'émission</Label><Input type="date" value={form.issued_at} onChange={e => set("issued_at", e.target.value)} className="bg-background border-border/60" /></div>
              <div className="space-y-1"><Label>Date d'échéance</Label><Input type="date" value={form.due_at} onChange={e => set("due_at", e.target.value)} className="bg-background border-border/60" /></div>
              <div className="space-y-1 col-span-2"><Label>Adresse client</Label><Input value={form.client_address} onChange={e => set("client_address", e.target.value)} className="bg-background border-border/60" /></div>
            </div>

            <div className="space-y-2">
              <Label>Prestations</Label>
              {form.items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={item.description} onChange={e => setItem(i, "description", e.target.value)} placeholder="Description" className="bg-background border-border/60 flex-1" />
                  <Input value={item.quantity} onChange={e => setItem(i, "quantity", parseFloat(e.target.value) || 0)} type="number" min={0} step={0.5} className="bg-background border-border/60 w-16" placeholder="Qté" />
                  <Input value={item.unit_price} onChange={e => setItem(i, "unit_price", parseFloat(e.target.value) || 0)} type="number" min={0} step={5} className="bg-background border-border/60 w-24" placeholder="Prix" />
                  <span className="text-sm text-muted-foreground w-20 text-right shrink-0">{fmt(item.quantity * item.unit_price, form.currency)}</span>
                  {form.items.length > 1 && <Button size="sm" variant="ghost" onClick={() => removeItem(i)}><X className="h-3 w-3" /></Button>}
                </div>
              ))}
              <Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Ajouter une ligne</Button>
              <div className="flex justify-end">
                <p className="text-lg font-bold text-foreground">Total : {fmt(total, form.currency)}</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Lien de paiement (QR code)</Label>
              <Input value={form.payment_link} onChange={e => set("payment_link", e.target.value)} placeholder="https://buy.stripe.com/…" className="bg-background border-border/60" />
              {form.payment_link && (
                <div className="flex justify-center mt-2 p-3 bg-background rounded-lg border border-border/40">
                  <QRCodeDisplay url={form.payment_link} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={v => set("status", v)}>
                  <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-surface border-border/60">
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="sent">Envoyée</SelectItem>
                    <SelectItem value="paid">Payée ✓</SelectItem>
                    <SelectItem value="cancelled">Annulée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Devise</Label>
                <Select value={form.currency} onValueChange={v => set("currency", v)}>
                  <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-surface border-border/60">
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1"><Label>Notes</Label><Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={2} className="bg-background border-border/60 resize-none" /></div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => mut.mutate()} disabled={mut.isPending || !form.client_name.trim()}>
            {mut.isPending ? "…" : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoicePreview({ form, total, branding }: { form: InvoiceForm; total: number; branding: any }) {
  return (
    <div className="bg-white text-gray-900 rounded-xl p-6 text-sm space-y-4">
      <div className="flex items-start justify-between">
        <div>
          {branding?.logo_url
            ? <img src={branding.logo_url} alt="Logo" className="h-14 object-contain mb-2" />
            : <div className="text-lg font-bold text-purple-700">{branding?.first_name} {branding?.last_name}</div>
          }
          <p className="text-gray-500 text-xs">{branding?.email}</p>
          <p className="text-gray-500 text-xs">{branding?.phone}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-purple-700">FACTURE</p>
          <p className="text-gray-500 text-xs">Émise le {form.issued_at}</p>
          {form.due_at && <p className="text-gray-500 text-xs">Échéance : {form.due_at}</p>}
        </div>
      </div>
      <div className="border-t border-gray-200 pt-3">
        <p className="font-semibold">{form.client_name}</p>
        {form.client_address && <p className="text-gray-500 text-xs whitespace-pre-line">{form.client_address}</p>}
      </div>
      <table className="w-full text-xs">
        <thead><tr className="bg-purple-50 text-purple-700"><th className="text-left p-2">Description</th><th className="text-center p-2">Qté</th><th className="text-right p-2">Prix unit.</th><th className="text-right p-2">Total</th></tr></thead>
        <tbody>
          {form.items.map((it, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="p-2">{it.description || "—"}</td>
              <td className="p-2 text-center">{it.quantity}</td>
              <td className="p-2 text-right">{fmt(it.unit_price, form.currency)}</td>
              <td className="p-2 text-right font-medium">{fmt(it.quantity * it.unit_price, form.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-between items-end">
        <div>
          {form.notes && <p className="text-gray-500 text-xs max-w-xs">{form.notes}</p>}
          {form.payment_link && <div className="mt-2"><QRCodeDisplay url={form.payment_link} /></div>}
        </div>
        <div className="text-right bg-purple-50 rounded-lg p-3">
          <p className="text-xs text-gray-500">Total à payer</p>
          <p className="text-xl font-bold text-purple-700">{fmt(total, form.currency)}</p>
        </div>
      </div>
    </div>
  );
}

const INV_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Brouillon", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  sent:      { label: "Envoyée",   color: "#5cc8fa", bg: "rgba(92,200,250,0.15)" },
  paid:      { label: "Payée ✓",  color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  cancelled: { label: "Annulée",   color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

function InvoicesTab({ contacts, branding }: { contacts: ClientContact[]; branding: any }) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [showBranding, setShowBranding] = useState(false);
  const [logoUrl, setLogoUrl] = useState(branding?.logo_url ?? "");
  const [paymentLink, setPaymentLink] = useState(branding?.payment_link ?? "");

  const invQ = useQuery({ queryKey: ["invoices"], queryFn: () => listMyInvoices({ data: {} }) });
  const invoices = (invQ.data ?? []) as Invoice[];

  const delMut = useMutation({
    mutationFn: (id: string) => deleteInvoice({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Invoice["status"] }) => updateInvoiceStatus({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const brandingMut = useMutation({
    mutationFn: () => updateTherapistBranding({ data: { logo_url: logoUrl || null, payment_link: paymentLink || null } }),
    onSuccess: () => { toast.success("Paramètres sauvegardés"); setShowBranding(false); qc.invalidateQueries({ queryKey: ["branding"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalPaid = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.total_amount), 0);
  const totalPending = invoices.filter(i => i.status === "sent").reduce((s, i) => s + Number(i.total_amount), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-surface border-border/60"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total encaissé</p><p className="text-xl font-bold text-green-400">{fmt(totalPaid)}</p></CardContent></Card>
        <Card className="bg-surface border-border/60"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">En attente</p><p className="text-xl font-bold text-yellow-400">{fmt(totalPending)}</p></CardContent></Card>
        <Card className="bg-surface border-border/60"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Factures</p><p className="text-xl font-bold text-foreground">{invoices.length}</p></CardContent></Card>
      </div>

      <div className="flex gap-2 justify-between">
        <Button size="sm" variant="outline" onClick={() => setShowBranding(true)}><Settings className="h-4 w-4 mr-1" />Logo & paiement</Button>
        <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" />Nouvelle facture
        </Button>
      </div>

      {showBranding && (
        <Card className="bg-surface border-primary/30">
          <CardHeader className="pb-2"><p className="text-sm font-semibold">Paramètres facturation</p></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>URL Logo (lien image)</Label>
              <div className="flex gap-2">
                <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" className="bg-background border-border/60" />
                {logoUrl && <img src={logoUrl} alt="logo" className="h-9 w-auto rounded border border-border/40 object-contain" />}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Lien de paiement par défaut</Label>
              <Input value={paymentLink} onChange={e => setPaymentLink(e.target.value)} placeholder="https://buy.stripe.com/…" className="bg-background border-border/60" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowBranding(false)}>Annuler</Button>
              <Button size="sm" className="bg-primary" onClick={() => brandingMut.mutate()} disabled={brandingMut.isPending}>Sauvegarder</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {invoices.map(inv => {
          const s = INV_STATUS_MAP[inv.status] ?? INV_STATUS_MAP.draft;
          return (
            <Card key={inv.id} className="bg-surface border-border/60 hover:border-primary/30 transition-colors">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</span>
                    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40` }} className="text-xs font-semibold px-2 py-0.5 rounded-full">{s.label}</span>
                  </div>
                  <p className="font-semibold text-foreground mt-0.5">{inv.client_name}</p>
                  <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{fmtDate(inv.issued_at)}</span>
                    {inv.due_at && <span>Échéance : {fmtDate(inv.due_at)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground">{fmt(Number(inv.total_amount), inv.currency)}</p>
                  {inv.status === "sent" && (
                    <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-300 text-xs mt-1 h-6"
                      onClick={() => statusMut.mutate({ id: inv.id, status: "paid" })}>
                      <Check className="h-3 w-3 mr-1" />Marquer payée
                    </Button>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(inv); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Supprimer cette facture ?")) delMut.mutate(inv.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {invoices.length === 0 && <p className="text-center text-muted-foreground py-10">Aucune facture. Créez-en une !</p>}
      </div>

      <InvoiceDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} contacts={contacts} branding={branding} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function CrmPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pipeline");
  const [contactDialog, setContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);

  const contactsQ = useQuery({ queryKey: ["crm-contacts"], queryFn: () => listMyContacts({ data: {} }) });
  const brandingQ = useQuery({ queryKey: ["branding"], queryFn: () => getTherapistBranding() });
  const contacts = (contactsQ.data ?? []) as ClientContact[];
  const branding = brandingQ.data;

  const delContactMut = useMutation({
    mutationFn: (id: string) => deleteContact({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm-contacts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (c: ClientContact) => { setEditingContact(c); setContactDialog(true); };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CRM Patients</h1>
          <p className="text-muted-foreground mt-1">{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditingContact(null); setContactDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nouveau contact
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-surface border border-border/60">
          <TabsTrigger value="pipeline" className="flex items-center gap-1.5"><LayoutGrid className="h-4 w-4" />Pipeline</TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-1.5"><Users className="h-4 w-4" />Contacts</TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-1.5"><CheckSquare className="h-4 w-4" />Tâches</TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-1.5"><FileText className="h-4 w-4" />Facturation</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab contacts={contacts} onEdit={openEdit} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-4">
          <ContactsTab contacts={contacts} onEdit={openEdit} onDelete={id => delContactMut.mutate(id)} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab contacts={contacts} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab contacts={contacts} branding={branding} />
        </TabsContent>
      </Tabs>

      <ContactDialog
        open={contactDialog}
        onClose={() => setContactDialog(false)}
        initial={editingContact}
        contacts={contacts}
      />
    </div>
  );
}
