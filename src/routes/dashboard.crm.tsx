import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, LayoutGrid, CheckSquare, FileText, Plus, Pencil, Trash2, X,
  Phone, Mail, Calendar, Tag, ChevronRight, Check, Clock, AlertCircle,
  QrCode, Download, Send, Eye, Settings, ArrowRight, Upload, ClipboardList,
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
import ImportContactsDialog from "@/components/dashboard/ImportContactsDialog";
import SessionNotesPanel from "@/components/dashboard/SessionNotesPanel";
import IntakePanel from "@/components/dashboard/IntakePanel";
import ClientHistoryPanel from "@/components/dashboard/ClientHistoryPanel";
import {
  listMyContacts, upsertContact, deleteContact,
  listMyTasks, upsertTask, deleteTask, type ClientContact, type CrmTask,
} from "@/lib/crm-therapist.functions";
import {
  listMyInvoices, getTherapistBranding, type Invoice,
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
  address_line1: string; address_line2: string; postal_code: string;
  city: string; canton: string; country: string;
};
const EMPTY_CONTACT: ContactForm = {
  first_name: "", last_name: "", email: "", phone: "", session_type: "",
  relation_status: "prospect", tags: [], private_notes: "", payment_link: "",
  address_line1: "", address_line2: "", postal_code: "", city: "", canton: "", country: "CH",
};

/** Cantons suisses (code officiel) pour la fiche de facturation. */
const CANTONS = [
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
];

/** Validation minimale de l'adresse : cohérence NPA/ville et pays obligatoire. */
function validateBillingAddress(f: ContactForm): string | null {
  if (!f.country.trim()) return "Le pays est obligatoire.";
  if (f.city.trim() && !f.postal_code.trim()) return "Le code postal est requis lorsque la ville est renseignée.";
  if (f.postal_code.trim() && !f.city.trim()) return "La ville est requise lorsque le code postal est renseigné.";
  return null;
}

function ContactDialog({ open, onClose, initial, contacts }: {
  open: boolean; onClose: () => void;
  initial?: ClientContact | null; contacts: ClientContact[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ContactForm>(
    initial ? { ...EMPTY_CONTACT, ...initial, email: initial.email ?? "", phone: initial.phone ?? "",
      session_type: initial.session_type ?? "", private_notes: initial.private_notes ?? "",
      payment_link: initial.payment_link ?? "",
      address_line1: initial.address_line1 ?? "", address_line2: initial.address_line2 ?? "",
      postal_code: initial.postal_code ?? "", city: initial.city ?? "",
      canton: initial.canton ?? "", country: initial.country ?? "CH" } : EMPTY_CONTACT
  );
  const [tagInput, setTagInput] = useState("");

  const saveMut = useMutation({
    mutationFn: () => {
      const err = validateBillingAddress(form);
      if (err) return Promise.reject(new Error(err));
      return upsertContact({ data: {
        ...form,
        email: form.email || null,
        phone: form.phone || null,
        address_line1: form.address_line1.trim() || null,
        address_line2: form.address_line2.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        canton: form.canton.trim() || null,
        country: form.country.trim() || "CH",
      } as any });
    },
    onSuccess: () => { toast.success("Contact sauvegardé"); qc.invalidateQueries({ queryKey: ["crm-contacts"] }); onClose(); },
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
            {!form.payment_link?.trim() && (
              <p className="text-xs text-amber-400/90 flex items-start gap-1.5 mt-1">
                <span aria-hidden>⚠️</span>
                <span>Aucun lien de paiement renseigné — vous pourrez l'ajouter plus tard depuis cette fiche.</span>
              </p>
            )}
          </div>

          <fieldset className="rounded-lg border border-border/60 p-4 space-y-3">
            <legend className="px-2 text-sm font-semibold text-foreground">Adresse de facturation</legend>
            <p className="text-xs text-muted-foreground -mt-1">
              Nécessaire pour émettre une facture. Facultative pour un simple prospect.
            </p>
            <div className="space-y-1">
              <Label htmlFor="addr1">Rue et numéro</Label>
              <Input id="addr1" value={form.address_line1} onChange={e => set("address_line1", e.target.value)}
                placeholder="Ex : Rue du Rhône 12" className="bg-background border-border/60" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="addr2">Complément d'adresse (facultatif)</Label>
              <Input id="addr2" value={form.address_line2} onChange={e => set("address_line2", e.target.value)}
                placeholder="Ex : c/o, étage, boîte postale" className="bg-background border-border/60" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="npa">Code postal</Label>
                <Input id="npa" value={form.postal_code} onChange={e => set("postal_code", e.target.value)}
                  inputMode="numeric" placeholder="1204" className="bg-background border-border/60" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="ville">Ville</Label>
                <Input id="ville" value={form.city} onChange={e => set("city", e.target.value)}
                  placeholder="Genève" className="bg-background border-border/60" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="canton">Canton (facultatif)</Label>
                <Select value={form.canton || "none"} onValueChange={v => set("canton", v === "none" ? "" : v)}>
                  <SelectTrigger id="canton" className="bg-background border-border/60"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="bg-surface border-border/60 max-h-64">
                    <SelectItem value="none">—</SelectItem>
                    {CANTONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pays">Pays *</Label>
                <Select value={form.country || "CH"} onValueChange={v => set("country", v)}>
                  <SelectTrigger id="pays" className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-surface border-border/60">
                    <SelectItem value="CH">Suisse</SelectItem>
                    <SelectItem value="FR">France</SelectItem>
                    <SelectItem value="DE">Allemagne</SelectItem>
                    <SelectItem value="IT">Italie</SelectItem>
                    <SelectItem value="AT">Autriche</SelectItem>
                    <SelectItem value="LI">Liechtenstein</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {validateBillingAddress(form) && (
              <p role="alert" className="text-xs text-amber-400/90">{validateBillingAddress(form)}</p>
            )}
          </fieldset>

          <div className="space-y-1">
            <Label>Notes privées</Label>
            <Textarea value={form.private_notes} onChange={e => set("private_notes", e.target.value)} rows={3} className="bg-background border-border/60 resize-none" />
          </div>

          {initial && (
            <SessionNotesPanel contactId={initial.id} contactName={`${initial.first_name} ${initial.last_name ?? ""}`.trim()} />
          )}
          {initial && (
            <ClientHistoryPanel
              contactId={initial.id}
              contactEmail={initial.email ?? null}
              contactName={`${initial.first_name} ${initial.last_name ?? ""}`.trim()}
            />
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
  const [importOpen, setImportOpen] = useState(false);

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
      <div className="flex gap-3 flex-wrap items-center">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" className="bg-surface border-border/60 max-w-xs" />
        <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="bg-surface border-border/60 w-40"><SelectValue placeholder="Tous" /></SelectTrigger>
          <SelectContent className="bg-surface border-border/60">
            <SelectItem value="all">Tous</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="ml-auto">
          <Upload className="h-4 w-4 mr-2" />Importer des contacts
        </Button>
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
      <ImportContactsDialog open={importOpen} onClose={() => setImportOpen(false)} />
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

// ── Facturation (pont vers le module conforme) ────────────────────────────────

const LEGACY_INV_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Brouillon", color: "#94a3b8", bg: "rgba(148,163,184,0.15)" },
  sent:      { label: "Envoyée",   color: "#5cc8fa", bg: "rgba(92,200,250,0.15)" },
  paid:      { label: "Payée",     color: "#34d399", bg: "rgba(52,211,153,0.15)" },
  cancelled: { label: "Annulée",   color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
};

function InvoicingBridgeTab() {
  const invQ = useQuery({ queryKey: ["invoices"], queryFn: () => listMyInvoices({ data: {} }) });
  const legacy = (invQ.data ?? []) as Invoice[];

  return (
    <div className="space-y-6">
      <Card className="bg-surface border-primary/40">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">La facturation a déménagé</h2>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Vos factures se créent désormais dans le module <strong>Facturation</strong>, conforme aux
                exigences suisses : bulletin QR-facture, numérotation continue, TVA par ligne, verrouillage
                des factures validées et suivi des encaissements.
              </p>
            </div>
          </div>
          <Button asChild className="bg-primary hover:bg-primary/90 min-h-11">
            <Link to="/dashboard/facturation">Ouvrir la facturation</Link>
          </Button>
        </CardContent>
      </Card>

      {legacy.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Archives</h3>
            <p className="text-xs text-muted-foreground">
              {legacy.length} ancienne{legacy.length > 1 ? "s" : ""} facture{legacy.length > 1 ? "s" : ""},
              conservée{legacy.length > 1 ? "s" : ""} en lecture seule.
            </p>
          </div>
          {legacy.map((inv) => {
            const st = LEGACY_INV_STATUS[inv.status] ?? LEGACY_INV_STATUS["draft"]!;
            return (
              <Card key={inv.id} className="bg-surface border-border/60">
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-muted-foreground">{inv.invoice_number}</span>
                    <p className="text-sm text-foreground truncate">{inv.client_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{ color: st.color, backgroundColor: st.bg }}
                    >
                      {st.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground tabular-nums">
                      {Number(inv.total_amount).toFixed(2)} CHF
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
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
          <TabsTrigger value="intake" className="flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />Admission</TabsTrigger>
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
          <InvoicingBridgeTab />
        </TabsContent>
        <TabsContent value="intake" className="mt-4">
          <IntakePanel slug={branding?.slug ?? null} />
        </TabsContent>
      </Tabs>

      <ContactDialog
        key={editingContact?.id ?? "new"}
        open={contactDialog}
        onClose={() => setContactDialog(false)}
        initial={editingContact}
        contacts={contacts}
      />
    </div>
  );
}
