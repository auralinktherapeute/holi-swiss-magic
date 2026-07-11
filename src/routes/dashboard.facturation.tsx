import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Receipt, Plus, Trash2, Settings2, Printer, CheckCircle2, XCircle, Clock } from "lucide-react";
import {
  getMyInvoiceSettings, upsertMyInvoiceSettings,
  listMyTherapistInvoices, createTherapistInvoice,
  updateInvoicePaymentStatus, deleteTherapistInvoice, renderInvoiceHtml,
  type TherapistInvoice, type TherapistInvoiceSettings,
} from "@/lib/therapist-invoices.functions";
import { listMyCrmContactsMinimal } from "@/lib/service-packages.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/facturation")({ component: Page });

type Contact = { id: string; first_name: string; last_name: string; email: string | null };
type Item = { description: string; quantite: number; prix_unitaire: number };

function Page() {
  const settingsFn = useServerFn(getMyInvoiceSettings);
  const upsertSettingsFn = useServerFn(upsertMyInvoiceSettings);
  const listFn = useServerFn(listMyTherapistInvoices);
  const createFn = useServerFn(createTherapistInvoice);
  const statusFn = useServerFn(updateInvoicePaymentStatus);
  const delFn = useServerFn(deleteTherapistInvoice);
  const renderFn = useServerFn(renderInvoiceHtml);
  const contactsFn = useServerFn(listMyCrmContactsMinimal);

  const [settings, setSettings] = useState<TherapistInvoiceSettings | null>(null);
  const [items, setItems] = useState<TherapistInvoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [openSet, setOpenSet] = useState(false);
  const [openNew, setOpenNew] = useState(false);

  async function refresh() {
    const [s, l, c] = await Promise.all([settingsFn(), listFn({ data: {} }), contactsFn()]);
    setSettings(s); setItems(l); setContacts(c);
  }
  useEffect(() => { refresh(); }, []);

  async function print(inv: TherapistInvoice) {
    try {
      const { html } = await renderFn({ data: { id: inv.id } });
      const w = window.open("", "_blank");
      if (!w) { toast.error("Le navigateur a bloqué la fenêtre"); return; }
      w.document.write(html);
      w.document.close();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Facturation
          </h1>
          <p className="text-sm text-muted-foreground">
            Génération de factures suisses conformes avec QR-facture.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOpenSet(true)}>
            <Settings2 className="h-4 w-4 mr-2" /> Réglages
          </Button>
          <Button onClick={() => setOpenNew(true)} disabled={!settings}>
            <Plus className="h-4 w-4 mr-2" /> Nouvelle facture
          </Button>
        </div>
      </header>

      {!settings && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 text-sm">
          Vous devez d'abord configurer vos <strong>réglages de facturation</strong> (IBAN, adresse) avant d'émettre une facture.
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Factures ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune facture pour le moment.</p>
        ) : (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">N°</th>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Client</th>
                  <th className="text-right p-3">Montant</th>
                  <th className="text-left p-3">Statut</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id} className="border-t">
                    <td className="p-3 font-mono">{inv.numero_facture}</td>
                    <td className="p-3">{new Date(inv.date_emission).toLocaleDateString("fr-CH")}</td>
                    <td className="p-3">
                      {(inv.metadata as any)?.client_name
                        ?? (inv.crm_client_contacts ? `${inv.crm_client_contacts.first_name} ${inv.crm_client_contacts.last_name}` : "-")}
                    </td>
                    <td className="p-3 text-right">{Number(inv.montant_total).toFixed(2)} {inv.currency}</td>
                    <td className="p-3">
                      <Select value={inv.statut_paiement}
                        onValueChange={async (v: any) => {
                          await statusFn({ data: { id: inv.id, statut_paiement: v } });
                          toast.success("Statut mis à jour"); refresh();
                        }}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en_attente"><span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />En attente</span></SelectItem>
                          <SelectItem value="paye"><span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" />Payée</span></SelectItem>
                          <SelectItem value="annule"><span className="inline-flex items-center gap-1"><XCircle className="h-3 w-3 text-red-500" />Annulée</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => print(inv)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost"
                        onClick={async () => {
                          if (!confirm("Supprimer cette facture ?")) return;
                          await delFn({ data: { id: inv.id } });
                          toast.success("Supprimée"); refresh();
                        }}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SettingsDialog open={openSet} onOpenChange={setOpenSet} existing={settings}
        onSaved={async () => { setOpenSet(false); await refresh(); }} upsertFn={upsertSettingsFn} />
      <NewInvoiceDialog open={openNew} onOpenChange={setOpenNew}
        contacts={contacts} defaultTva={settings?.assujetti_tva ? Number(settings.taux_tva ?? 0) : 0}
        onSaved={async () => { setOpenNew(false); await refresh(); }} createFn={createFn} />
    </div>
  );
}

function SettingsDialog({ open, onOpenChange, existing, onSaved, upsertFn }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  existing: TherapistInvoiceSettings | null;
  onSaved: () => Promise<void>; upsertFn: (a: any) => Promise<any>;
}) {
  const [iban, setIban] = useState(""); const [rue, setRue] = useState("");
  const [npa, setNpa] = useState(""); const [ville, setVille] = useState("");
  const [pays, setPays] = useState("CH"); const [tva, setTva] = useState("");
  const [ass, setAss] = useState(false); const [taux, setTaux] = useState<number | "">("");
  const [next, setNext] = useState(1); const [reset, setReset] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIban(existing?.iban_ou_qr_iban ?? "");
    setRue(existing?.adresse_rue ?? ""); setNpa(existing?.adresse_npa ?? "");
    setVille(existing?.adresse_ville ?? ""); setPays(existing?.adresse_pays ?? "CH");
    setTva(existing?.numero_tva ?? ""); setAss(existing?.assujetti_tva ?? false);
    setTaux(existing?.taux_tva ?? ""); setNext(existing?.next_invoice_number ?? 1);
    setReset(existing?.remise_a_zero_annuelle ?? true);
  }, [open, existing]);

  async function save() {
    setSaving(true);
    try {
      await upsertFn({ data: {
        iban_ou_qr_iban: iban.trim(), adresse_rue: rue.trim(),
        adresse_npa: npa.trim(), adresse_ville: ville.trim(), adresse_pays: pays.trim() || "CH",
        numero_tva: tva.trim() || null, assujetti_tva: ass,
        taux_tva: ass ? (typeof taux === "number" ? taux : Number(taux) || 0) : null,
        next_invoice_number: Number(next) || 1, remise_a_zero_annuelle: reset,
      } });
      toast.success("Réglages enregistrés"); await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Réglages de facturation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>IBAN ou QR-IBAN *</Label>
            <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="CH..." /></div>
          <div><Label>Rue *</Label>
            <Input value={rue} onChange={(e) => setRue(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><Label>NPA *</Label><Input value={npa} onChange={(e) => setNpa(e.target.value)} /></div>
            <div className="col-span-2"><Label>Ville *</Label><Input value={ville} onChange={(e) => setVille(e.target.value)} /></div>
          </div>
          <div><Label>Pays</Label><Input value={pays} onChange={(e) => setPays(e.target.value)} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={ass} onCheckedChange={setAss} id="ass" />
            <Label htmlFor="ass">Assujetti à la TVA</Label>
          </div>
          {ass && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>N° TVA</Label><Input value={tva} onChange={(e) => setTva(e.target.value)} placeholder="CHE-…"/></div>
              <div><Label>Taux TVA (%)</Label>
                <Input type="number" step="0.1" value={taux} onChange={(e) => setTaux(e.target.value === "" ? "" : Number(e.target.value))} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 items-end">
            <div><Label>Prochain n°</Label>
              <Input type="number" value={next} onChange={(e) => setNext(Number(e.target.value) || 1)} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={reset} onCheckedChange={setReset} id="rz" />
              <Label htmlFor="rz">Remise à zéro annuelle</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewInvoiceDialog({ open, onOpenChange, contacts, defaultTva, onSaved, createFn }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  contacts: Contact[]; defaultTva: number;
  onSaved: () => Promise<void>; createFn: (a: any) => Promise<any>;
}) {
  const [clientId, setClientId] = useState<string>("");
  const [clientName, setClientName] = useState(""); const [clientAddress, setClientAddress] = useState("");
  const [description, setDescription] = useState("");
  const [tvaTaux, setTvaTaux] = useState<number>(defaultTva);
  const [items, setItems] = useState<Item[]>([{ description: "Séance", quantite: 1, prix_unitaire: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setClientId(""); setClientName(""); setClientAddress("");
    setDescription(""); setTvaTaux(defaultTva);
    setItems([{ description: "Séance", quantite: 1, prix_unitaire: 0 }]);
  }, [open, defaultTva]);

  useEffect(() => {
    if (!clientId) return;
    const c = contacts.find((x) => x.id === clientId);
    if (c) setClientName(`${c.first_name} ${c.last_name}`.trim());
  }, [clientId, contacts]);

  const ht = items.reduce((s, i) => s + (Number(i.quantite) || 0) * (Number(i.prix_unitaire) || 0), 0);
  const tva = Math.round(ht * tvaTaux) / 100;
  const total = ht + tva;

  async function save() {
    if (!clientName.trim()) { toast.error("Nom du client requis"); return; }
    if (ht <= 0) { toast.error("Montant nul"); return; }
    setSaving(true);
    try {
      await createFn({ data: {
        client_id: clientId || null,
        montant_ht: ht,
        tva_taux: tvaTaux || null,
        currency: "CHF",
        metadata: {
          description: description || null,
          client_name: clientName.trim(),
          client_address: clientAddress || null,
          items,
        },
      } });
      toast.success("Facture créée"); await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nouvelle facture</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Client CRM (optionnel)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un contact CRM…" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Nom du client *</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
          <div><Label>Adresse du client</Label>
            <Textarea rows={2} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></div>
          <div><Label>Description / note</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>

          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm">Lignes</h3>
              <Button size="sm" variant="outline"
                onClick={() => setItems((s) => [...s, { description: "", quantite: 1, prix_unitaire: 0 }])}>
                <Plus className="h-3 w-3 mr-1" /> Ligne
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input className="col-span-6" placeholder="Description" value={it.description}
                    onChange={(e) => setItems((s) => s.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))} />
                  <Input className="col-span-2" type="number" step="1" value={it.quantite}
                    onChange={(e) => setItems((s) => s.map((x, idx) => idx === i ? { ...x, quantite: Number(e.target.value) || 0 } : x))} />
                  <Input className="col-span-3" type="number" step="0.05" placeholder="Prix unitaire" value={it.prix_unitaire}
                    onChange={(e) => setItems((s) => s.map((x, idx) => idx === i ? { ...x, prix_unitaire: Number(e.target.value) || 0 } : x))} />
                  <Button className="col-span-1" size="icon" variant="ghost"
                    onClick={() => setItems((s) => s.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>TVA (%)</Label>
              <Input type="number" step="0.1" value={tvaTaux}
                onChange={(e) => setTvaTaux(Number(e.target.value) || 0)} /></div>
          </div>

          <div className="border-t pt-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Sous-total HT</span><span>{ht.toFixed(2)} CHF</span></div>
            {tvaTaux > 0 && <div className="flex justify-between"><span>TVA ({tvaTaux}%)</span><span>{tva.toFixed(2)} CHF</span></div>}
            <div className="flex justify-between font-semibold"><span>Total</span><span>{total.toFixed(2)} CHF</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? "…" : "Créer la facture"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}