import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Package, Plus, Pencil, Trash2, MinusCircle, User, Calendar, CircleCheck, ClipboardList, X,
} from "lucide-react";
import {
  listMyServicePackages, upsertServicePackage, deleteServicePackage,
  listMyClientPackages, upsertClientPackage, deleteClientPackage,
  consumeClientPackageSession, listMyCrmContactsMinimal,
  type ServicePackage, type ClientPackage,
} from "@/lib/service-packages.functions";
import {
  listMyQuestionnaires, listMyAssignments, upsertAssignment, deleteAssignment,
  type Questionnaire, type QuestionnaireAssignment,
} from "@/lib/questionnaires.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/forfaits")({ component: Page });

type Contact = { id: string; first_name: string; last_name: string; email: string | null };

function Page() {
  const fetchPackages = useServerFn(listMyServicePackages);
  const fetchClientPackages = useServerFn(listMyClientPackages);
  const fetchContacts = useServerFn(listMyCrmContactsMinimal);

  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [clientPackages, setClientPackages] = useState<ClientPackage[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, cp, c] = await Promise.all([
        (fetchPackages as any)(),
        (fetchClientPackages as any)({ data: {} }),
        (fetchContacts as any)(),
      ]);
      setPackages(p ?? []);
      setClientPackages(cp ?? []);
      setContacts(c ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10 space-y-10">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Forfaits
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Créez des forfaits de séances et suivez la consommation de chaque client.
          </p>
        </div>
      </header>

      <CatalogSection packages={packages} loading={loading} onChange={refresh} />

      <AssignmentsSection packages={packages} />

      <ClientPackagesSection
        clientPackages={clientPackages}
        packages={packages}
        contacts={contacts}
        loading={loading}
        onChange={refresh}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Catalogue
// ────────────────────────────────────────────────────────────────
function AssignmentsSection({ packages }: { packages: ServicePackage[] }) {
  const fetchQs = useServerFn(listMyQuestionnaires);
  const fetchAs = useServerFn(listMyAssignments);
  const saveFn = useServerFn(upsertAssignment);
  const removeFn = useServerFn(deleteAssignment);

  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [assignments, setAssignments] = useState<QuestionnaireAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selPackage, setSelPackage] = useState<string>("");
  const [selQuestionnaire, setSelQuestionnaire] = useState<string>("");

  const refresh = async () => {
    setLoading(true);
    try {
      const [q, a] = await Promise.all([(fetchQs as any)(), (fetchAs as any)()]);
      setQuestionnaires(q ?? []);
      setAssignments(a ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    } finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const activeQuestionnaires = useMemo(() => questionnaires.filter((q) => q.actif), [questionnaires]);

  const add = async () => {
    if (!selPackage || !selQuestionnaire) return;
    try {
      await (saveFn as any)({ data: { questionnaire_id: selQuestionnaire, package_id: selPackage } });
      toast.success("Questionnaire lié au forfait");
      setSelQuestionnaire("");
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const remove = async (id: string) => {
    try {
      await (removeFn as any)({ data: { id } });
      toast.success("Lien supprimé");
      await refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const byPackage = useMemo(() => {
    const m = new Map<string, QuestionnaireAssignment[]>();
    for (const a of assignments) {
      if (!a.package_id) continue;
      const arr = m.get(a.package_id) ?? [];
      arr.push(a);
      m.set(a.package_id, arr);
    }
    return m;
  }, [assignments]);

  if (packages.length === 0) return null;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" /> Questionnaires liés aux forfaits
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Recommandez automatiquement un questionnaire à remplir lors de l'achat d'un forfait.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="asg-pkg">Forfait</Label>
            <Select value={selPackage} onValueChange={setSelPackage}>
              <SelectTrigger id="asg-pkg"><SelectValue placeholder="Choisir un forfait" /></SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="asg-q">Questionnaire</Label>
            <Select value={selQuestionnaire} onValueChange={setSelQuestionnaire}>
              <SelectTrigger id="asg-q">
                <SelectValue placeholder={activeQuestionnaires.length === 0 ? "Aucun questionnaire actif" : "Choisir un questionnaire"} />
              </SelectTrigger>
              <SelectContent>
                {activeQuestionnaires.map((q) => (
                  <SelectItem key={q.id} value={q.id}>{q.titre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={add} disabled={!selPackage || !selQuestionnaire} className="gap-2">
            <Plus className="h-4 w-4" />Lier
          </Button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune association pour le moment.</p>
        ) : (
          <ul className="divide-y divide-border">
            {packages.filter((p) => byPackage.has(p.id)).map((p) => (
              <li key={p.id} className="py-3 flex flex-col gap-2">
                <div className="text-sm font-medium">{p.nom}</div>
                <div className="flex flex-wrap gap-2">
                  {(byPackage.get(p.id) ?? []).map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                      {a.questionnaires?.titre ?? "Questionnaire"}
                      <button
                        type="button"
                        onClick={() => remove(a.id)}
                        aria-label="Retirer"
                        className="ml-1 rounded-full p-0.5 hover:bg-background"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CatalogSection({
  packages, loading, onChange,
}: { packages: ServicePackage[]; loading: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState<ServicePackage | null>(null);
  const [open, setOpen] = useState(false);
  const removeFn = useServerFn(deleteServicePackage);

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (p: ServicePackage) => { setEditing(p); setOpen(true); };
  const remove = async (p: ServicePackage) => {
    if (!confirm(`Supprimer le forfait « ${p.nom} » ? Cette action est irréversible.`)) return;
    try {
      await (removeFn as any)({ data: { id: p.id } });
      toast.success("Forfait supprimé");
      onChange();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Catalogue de forfaits</h2>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" />Nouveau forfait</Button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : packages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun forfait pour le moment. Créez-en un pour proposer des packages de séances à vos clients.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <article key={p.id} className="rounded-lg border border-border bg-surface p-4 flex flex-col gap-3">
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{p.nom}</h3>
                  {!p.actif && <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs">Inactif</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(p)} aria-label="Modifier" className="h-9 w-9 inline-flex items-center justify-center rounded hover:bg-muted"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(p)} aria-label="Supprimer" className="h-9 w-9 inline-flex items-center justify-center rounded hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </header>
              {p.description && <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-muted-foreground text-xs">Prix total</dt><dd className="font-medium">{p.prix_total.toFixed(2)} CHF</dd></div>
                <div><dt className="text-muted-foreground text-xs">Séances</dt><dd className="font-medium">{p.nombre_seances_incluses}</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground text-xs">Validité</dt><dd className="font-medium">{p.validite_jours ? `${p.validite_jours} jours` : "Sans expiration"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      )}

      <PackageDialog open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { setOpen(false); onChange(); }} />
    </section>
  );
}

function PackageDialog({
  open, onOpenChange, editing, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: ServicePackage | null; onSaved: () => void;
}) {
  const saveFn = useServerFn(upsertServicePackage);
  const [nom, setNom] = useState("");
  const [description, setDescription] = useState("");
  const [prix, setPrix] = useState<string>("");
  const [seances, setSeances] = useState<string>("");
  const [validite, setValidite] = useState<string>("");
  const [actif, setActif] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNom(editing?.nom ?? "");
      setDescription(editing?.description ?? "");
      setPrix(editing?.prix_total?.toString() ?? "");
      setSeances(editing?.nombre_seances_incluses?.toString() ?? "");
      setValidite(editing?.validite_jours?.toString() ?? "");
      setActif(editing?.actif ?? true);
    }
  }, [open, editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await (saveFn as any)({
        data: {
          id: editing?.id,
          nom: nom.trim(),
          description: description.trim() || null,
          prix_total: Number(prix),
          nombre_seances_incluses: Number(seances),
          validite_jours: validite ? Number(validite) : null,
          actif,
        },
      });
      toast.success(editing ? "Forfait mis à jour" : "Forfait créé");
      onSaved();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Modifier le forfait" : "Nouveau forfait"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fp-nom">Nom du forfait</Label>
            <Input id="fp-nom" required value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex : Forfait 5 séances bien-être" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-desc">Description</Label>
            <Textarea id="fp-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionnel" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fp-prix">Prix total (CHF)</Label>
              <Input id="fp-prix" type="number" min="0" step="0.01" required value={prix} onChange={(e) => setPrix(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp-nb">Nombre de séances</Label>
              <Input id="fp-nb" type="number" min="1" step="1" required value={seances} onChange={(e) => setSeances(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fp-val">Validité (jours)</Label>
            <Input id="fp-val" type="number" min="1" step="1" value={validite} onChange={(e) => setValidite(e.target.value)} placeholder="Laisser vide = sans expiration" />
          </div>
          <div className="flex items-center gap-3">
            <Switch id="fp-actif" checked={actif} onCheckedChange={setActif} />
            <Label htmlFor="fp-actif">Actif (visible et proposable)</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────
// Forfaits clients + décompte
// ────────────────────────────────────────────────────────────────
function ClientPackagesSection({
  clientPackages, packages, contacts, loading, onChange,
}: {
  clientPackages: ClientPackage[]; packages: ServicePackage[]; contacts: Contact[];
  loading: boolean; onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activePackages = useMemo(() => packages.filter((p) => p.actif), [packages]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Forfaits vendus aux clients</h2>
        <Button onClick={() => setOpen(true)} className="gap-2" disabled={activePackages.length === 0 || contacts.length === 0}>
          <Plus className="h-4 w-4" />Attribuer un forfait
        </Button>
      </div>

      {activePackages.length === 0 && (
        <p className="text-sm text-muted-foreground">Créez d'abord un forfait dans le catalogue ci-dessus.</p>
      )}
      {contacts.length === 0 && activePackages.length > 0 && (
        <p className="text-sm text-muted-foreground">Ajoutez un contact dans le CRM pour lui attribuer un forfait.</p>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Chargement…</div>
      ) : clientPackages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Aucun forfait client pour l'instant.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clientPackages.map((cp) => (
            <ClientPackageCard key={cp.id} cp={cp} onChange={onChange} />
          ))}
        </div>
      )}

      <AssignPackageDialog
        open={open} onOpenChange={setOpen}
        packages={activePackages} contacts={contacts}
        onSaved={() => { setOpen(false); onChange(); }}
      />
    </section>
  );
}

function ClientPackageCard({ cp, onChange }: { cp: ClientPackage; onChange: () => void }) {
  const total = cp.service_packages?.nombre_seances_incluses ?? 0;
  const used = cp.nombre_seances_utilisees;
  const remaining = Math.max(total - used, 0);
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const consumeFn = useServerFn(consumeClientPackageSession);
  const removeFn = useServerFn(deleteClientPackage);
  const [busy, setBusy] = useState(false);

  const statutBadge = {
    actif: "bg-emerald-100 text-emerald-800",
    expire: "bg-amber-100 text-amber-800",
    epuise: "bg-slate-200 text-slate-700",
  }[cp.statut];
  const paiementBadge = {
    paye: "bg-emerald-50 text-emerald-700 border-emerald-200",
    acompte: "bg-amber-50 text-amber-700 border-amber-200",
    a_regler: "bg-red-50 text-red-700 border-red-200",
  }[cp.statut_paiement];
  const paiementLabel = { paye: "Payé", acompte: "Acompte", a_regler: "À régler" }[cp.statut_paiement];

  const decompter = async () => {
    if (cp.statut !== "actif") { toast.error("Ce forfait n'est plus actif."); return; }
    if (!confirm("Décompter une séance ? Cette action mettra à jour le forfait immédiatement.")) return;
    setBusy(true);
    try {
      await (consumeFn as any)({ data: { client_package_id: cp.id } });
      toast.success("Séance décomptée");
      onChange();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm("Supprimer ce forfait client et tout son historique ?")) return;
    try {
      await (removeFn as any)({ data: { id: cp.id } });
      toast.success("Forfait supprimé");
      onChange();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const client = cp.crm_client_contacts;
  return (
    <article className="rounded-lg border border-border bg-surface p-4 space-y-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm text-muted-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" />{client ? `${client.first_name} ${client.last_name}` : "Client inconnu"}</div>
          <h3 className="font-semibold">{cp.service_packages?.nom ?? "—"}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-xs px-2 py-0.5 rounded ${statutBadge}`}>{cp.statut}</span>
          <span className={`text-xs px-2 py-0.5 rounded border ${paiementBadge}`}>{paiementLabel}</span>
        </div>
      </header>

      <div>
        <div className="flex items-baseline justify-between text-sm mb-1">
          <span><span className="font-semibold">{used}</span> / {total} séances utilisées</span>
          <span className="text-muted-foreground">{remaining} restante{remaining > 1 ? "s" : ""}</span>
        </div>
        <div className="h-2 rounded bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-transform origin-left" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Achat : {cp.date_achat}</div>
        <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Expire : {cp.date_expiration ?? "—"}</div>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={decompter} disabled={busy || cp.statut !== "actif"} className="gap-1.5">
          <MinusCircle className="h-4 w-4" />Décompter une séance
        </Button>
        <Button size="sm" variant="outline" onClick={remove} className="gap-1.5 text-red-600 hover:text-red-700">
          <Trash2 className="h-4 w-4" />Supprimer
        </Button>
      </div>
    </article>
  );
}

function AssignPackageDialog({
  open, onOpenChange, packages, contacts, onSaved,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  packages: ServicePackage[]; contacts: Contact[]; onSaved: () => void;
}) {
  const saveFn = useServerFn(upsertClientPackage);
  const [clientId, setClientId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [dateAchat, setDateAchat] = useState(() => new Date().toISOString().slice(0, 10));
  const [statutPaiement, setStatutPaiement] = useState<"paye" | "acompte" | "a_regler">("a_regler");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(""); setPackageId(""); setStatutPaiement("a_regler"); setNotes("");
      setDateAchat(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !packageId) return;
    setSaving(true);
    try {
      await (saveFn as any)({
        data: {
          client_id: clientId, package_id: packageId,
          date_achat: dateAchat, statut_paiement: statutPaiement,
          notes: notes.trim() || null,
        },
      });
      toast.success("Forfait attribué");
      onSaved();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Attribuer un forfait à un client</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ap-client">Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger id="ap-client"><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.email ? ` — ${c.email}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-package">Forfait</Label>
            <Select value={packageId} onValueChange={setPackageId}>
              <SelectTrigger id="ap-package"><SelectValue placeholder="Sélectionner un forfait" /></SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nom} — {p.nombre_seances_incluses} séances · {p.prix_total.toFixed(2)} CHF</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ap-date">Date d'achat</Label>
              <Input id="ap-date" type="date" value={dateAchat} onChange={(e) => setDateAchat(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ap-statut">Statut paiement</Label>
              <Select value={statutPaiement} onValueChange={(v) => setStatutPaiement(v as any)}>
                <SelectTrigger id="ap-statut"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paye">Payé</SelectItem>
                  <SelectItem value="acompte">Acompte</SelectItem>
                  <SelectItem value="a_regler">À régler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-notes">Notes</Label>
            <Textarea id="ap-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={saving || !clientId || !packageId} className="gap-1.5">
              <CircleCheck className="h-4 w-4" />
              {saving ? "Enregistrement…" : "Attribuer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}