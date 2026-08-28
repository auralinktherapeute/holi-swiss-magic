import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Receipt, Plus, Trash2, Settings2, Printer, Lock, Copy, Ban,
  RotateCcw, Mail, AlertTriangle, CreditCard, ShieldCheck,
} from "lucide-react";
import {
  getMyInvoiceSettings, upsertMyInvoiceSettings,
  listMyTherapistInvoices, createInvoiceDraft, updateInvoiceDraft,
  getTherapistInvoice, checkInvoiceReadiness, validateInvoice,
  duplicateInvoice, cancelInvoice, createCreditNote,
  deleteTherapistInvoice, renderInvoiceHtml, emailInvoiceToClient,
  addInvoicePayment, deleteInvoicePayment, listVatRates,
  type TherapistInvoice, type TherapistInvoiceSettings,
  type TherapistInvoiceLine, type TherapistInvoicePayment,
} from "@/lib/therapist-invoices.functions";
import { listMyCrmContactsMinimal } from "@/lib/service-packages.functions";
import InvoiceReminders from "@/components/dashboard/InvoiceReminders";
import InvoiceReports from "@/components/dashboard/InvoiceReports";
import { MissingInvoices } from "@/components/dashboard/MissingInvoices";
import InvoiceLogoUploader from "@/components/dashboard/InvoiceLogoUploader";

import {
  computeInvoiceTotals, isValidIban, isQrIban, missingInvoiceSettings,
  VAT_WARNING, round2, type InvoiceLineInput,
} from "@/lib/swiss-invoice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/dashboard/facturation")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Facturation suisse — Espace thérapeute HoliSwiss" },
      { name: "description", content: "Créez vos factures suisses conformes avec QR-facture, suivez vos paiements et vos avoirs depuis votre espace HoliSwiss." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Contact = { id: string; first_name: string; last_name: string; email: string | null };
type VatRate = { code: string; label: string; rate: number; note: string | null };

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  validee: { label: "Validée", cls: "bg-primary/15 text-primary" },
  envoyee: { label: "Envoyée", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  consultee: { label: "Consultée", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  partiellement_payee: { label: "Partiellement payée", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  payee: { label: "Payée", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  en_retard: { label: "En retard", cls: "bg-destructive/15 text-destructive" },
  annulee: { label: "Annulée", cls: "bg-muted text-muted-foreground line-through" },
  avoir: { label: "Avoir", cls: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400" },
  erreur_envoi: { label: "Erreur d'envoi", cls: "bg-destructive/15 text-destructive" },
};

function StatusBadge({ statut }: { statut: string }) {
  const s = STATUS_STYLE[statut] ?? { label: statut, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

function Page() {
  const settingsFn = useServerFn(getMyInvoiceSettings);
  const upsertSettingsFn = useServerFn(upsertMyInvoiceSettings);
  const listFn = useServerFn(listMyTherapistInvoices);
  const contactsFn = useServerFn(listMyCrmContactsMinimal);
  const vatFn = useServerFn(listVatRates);
  const renderFn = useServerFn(renderInvoiceHtml);

  const [settings, setSettings] = useState<TherapistInvoiceSettings | null>(null);
  const [invoices, setInvoices] = useState<TherapistInvoice[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [vatRates, setVatRates] = useState<VatRate[]>([]);
  const [openSet, setOpenSet] = useState(false);
  const [editorId, setEditorId] = useState<string | null | "new">(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [s, l, c, v] = await Promise.all([
      settingsFn(), listFn({ data: {} }), contactsFn(), vatFn(),
    ]);
    setSettings(s); setInvoices(l); setContacts(c); setVatRates(v); setLoading(false);
  }, [settingsFn, listFn, contactsFn, vatFn]);

  useEffect(() => { refresh().catch((e) => { toast.error(e.message); setLoading(false); }); }, [refresh]);

  const missing = missingInvoiceSettings(settings);

  async function print(inv: TherapistInvoice) {
    try {
      const { html } = await renderFn({ data: { id: inv.id } });
      const w = window.open("", "_blank");
      if (!w) { toast.error("Le navigateur a bloqué la fenêtre"); return; }
      w.document.write(html); w.document.close();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  }

  const stats = useMemo(() => {
    const active = invoices.filter((i) => !["brouillon", "annulee"].includes(i.statut));
    const facture = round2(active.reduce((s, i) => s + Number(i.montant_total), 0));
    const encaisse = round2(active.reduce((s, i) => s + Number(i.montant_paye ?? 0), 0));
    return {
      facture, encaisse, solde: round2(facture - encaisse),
      retard: active.filter((i) => i.statut === "en_retard").length,
    };
  }, [invoices]);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" aria-hidden="true" /> Facturation
          </h1>
          <p className="text-sm text-muted-foreground">
            Factures suisses conformes, QR-facture et suivi des encaissements.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOpenSet(true)} className="min-h-11">
            <Settings2 className="h-4 w-4 mr-2" aria-hidden="true" /> Paramètres de facturation
          </Button>
          <Button onClick={() => setEditorId("new")} disabled={missing.length > 0} className="min-h-11">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Nouvelle facture
          </Button>
        </div>
      </header>

      {!loading && missing.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Complétez vos paramètres de facturation avant d'émettre une facture
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-0.5">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
          <Button size="sm" variant="outline" className="mt-3 min-h-11" onClick={() => setOpenSet(true)}>
            Ouvrir les paramètres
          </Button>
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Chiffre d'affaires facturé", value: `${stats.facture.toFixed(2)} CHF` },
          { label: "Encaissé", value: `${stats.encaisse.toFixed(2)} CHF` },
          { label: "Solde restant", value: `${stats.solde.toFixed(2)} CHF` },
          { label: "Factures en retard", value: String(stats.retard) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-lg font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </section>

      {!loading && missing.length === 0 && (
        <MissingInvoices
          onCreated={(id) => { setEditorId(id); void refresh(); }}
        />
      )}

      {!loading && <InvoiceReminders onSent={() => { void refresh(); }} />}


      {!loading && <InvoiceReports />}

      <section>

        <h2 className="text-lg font-semibold mb-3">Factures ({invoices.length})</h2>
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune facture pour le moment. Créez votre première facture depuis le bouton ci-dessus.
          </p>
        ) : (
          <div className="overflow-x-auto border border-border/60 rounded-lg">
            <table className="w-full text-sm">
              <caption className="sr-only">Liste de vos factures</caption>
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="text-left p-3">N°</th>
                  <th scope="col" className="text-left p-3">Date</th>
                  <th scope="col" className="text-left p-3">Client</th>
                  <th scope="col" className="text-right p-3">Total</th>
                  <th scope="col" className="text-right p-3">Solde</th>
                  <th scope="col" className="text-left p-3">Statut</th>
                  <th scope="col" className="p-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-t border-border/60">
                    <td className="p-3 font-mono text-xs">{inv.numero_facture}</td>
                    <td className="p-3">{new Date(inv.date_emission).toLocaleDateString("fr-CH")}</td>
                    <td className="p-3">{inv.client_nom ?? (inv.metadata as any)?.client_name ?? "—"}</td>
                    <td className="p-3 text-right">{Number(inv.montant_total).toFixed(2)} {inv.currency}</td>
                    <td className="p-3 text-right">
                      {round2(Number(inv.montant_total) - Number(inv.montant_paye ?? 0)).toFixed(2)}
                    </td>
                    <td className="p-3"><StatusBadge statut={inv.statut} /></td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="min-h-11"
                        onClick={() => setDetailId(inv.id)}>Ouvrir</Button>
                      <Button size="icon" variant="ghost" className="min-h-11 min-w-11"
                        aria-label={`Imprimer la facture ${inv.numero_facture}`} onClick={() => print(inv)}>
                        <Printer className="h-4 w-4" aria-hidden="true" />
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
        upsertFn={upsertSettingsFn} onSaved={async () => { setOpenSet(false); await refresh(); }} />

      {editorId && (
        <InvoiceEditor
          invoiceId={editorId === "new" ? null : editorId}
          contacts={contacts} vatRates={vatRates} settings={settings}
          onClose={() => setEditorId(null)}
          onSaved={async () => { setEditorId(null); await refresh(); }}
        />
      )}

      {detailId && (
        <InvoiceDetail
          id={detailId} onClose={() => setDetailId(null)}
          onEdit={(id) => { setDetailId(null); setEditorId(id); }}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

// ── Paramètres de facturation ───────────────────────────────────────

type FieldProps = { k: string; label: string; type?: string; ph?: string; state: Record<string, any>; set: (k: string, v: any) => void; error?: boolean; };

function Field({ k, label, type = "text", ph = "", state, set, error }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`set-${k}`}>{label}</Label>
      <Input id={`set-${k}`} type={type} value={state[k] ?? ""} placeholder={ph}
        aria-invalid={!!error}
        onChange={(e) => set(k, type === "number" ? Number(e.target.value) : e.target.value)} />
      {error && <p className="text-xs text-destructive">Ce champ est obligatoire.</p>}
    </div>
  );
}


function SettingsDialog({ open, onOpenChange, existing, onSaved, upsertFn }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  existing: TherapistInvoiceSettings | null;
  onSaved: () => Promise<void>; upsertFn: (a: any) => Promise<any>;
}) {
  const [f, setF] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!open) return;
    setF({
      iban_ou_qr_iban: existing?.iban_ou_qr_iban ?? "",
      qr_iban: existing?.qr_iban ?? "",
      adresse_rue: existing?.adresse_rue ?? "",
      adresse_npa: existing?.adresse_npa ?? "",
      adresse_ville: existing?.adresse_ville ?? "",
      adresse_pays: existing?.adresse_pays ?? "CH",
      raison_sociale: existing?.raison_sociale ?? "",
      numero_ide: existing?.numero_ide ?? "",
      telephone: existing?.telephone ?? "",
      email_pro: existing?.email_pro ?? "",
      logo_url: existing?.logo_url ?? "",
      titulaire_nom: existing?.titulaire_nom ?? "",
      titulaire_adresse: existing?.titulaire_adresse ?? "",
      titulaire_npa: existing?.titulaire_npa ?? "",
      titulaire_ville: existing?.titulaire_ville ?? "",
      titulaire_pays: existing?.titulaire_pays ?? "CH",
      devise_defaut: existing?.devise_defaut ?? "CHF",
      delai_paiement_jours: existing?.delai_paiement_jours ?? 30,
      conditions_paiement: existing?.conditions_paiement ?? "",
      mention_tva: existing?.mention_tva ?? "",
      mode_tva: existing?.mode_tva ?? "exclusive",
      pied_de_page: existing?.pied_de_page ?? "",
      numero_tva: existing?.numero_tva ?? "",
      assujetti_tva: existing?.assujetti_tva ?? false,
      taux_tva: existing?.taux_tva ?? "",
      next_invoice_number: existing?.next_invoice_number ?? 1,
      remise_a_zero_annuelle: existing?.remise_a_zero_annuelle ?? true,
    });
    setShowErrors(false);
  }, [open, existing]);


  const ibanErr = f.iban_ou_qr_iban && !isValidIban(f.iban_ou_qr_iban)
    ? "IBAN invalide (chiffres de contrôle)." : null;
  const qrIbanErr = f.qr_iban && !isQrIban(f.qr_iban)
    ? "Ce n'est pas un QR-IBAN valide (IID 30000–31999)." : null;

  // Champs obligatoires côté serveur : on les contrôle ici pour afficher un
  // message lisible plutôt que l'erreur de validation brute.
  const REQUIRED: Array<[string, string]> = [
    ["iban_ou_qr_iban", "IBAN"],
    ["adresse_rue", "Rue"],
    ["adresse_npa", "NPA"],
    ["adresse_ville", "Ville"],
  ];
  
  const missing = REQUIRED.filter(([k]) => !String(f[k] ?? "").trim());
  const miss = (k: string) => showErrors && missing.some(([mk]) => mk === k);

  async function save() {
    setShowErrors(true);
    if (missing.length > 0) {
      toast.error(`Champs obligatoires manquants : ${missing.map(([, l]) => l).join(", ")}`);
      return;
    }
    if (ibanErr || qrIbanErr) { toast.error("Corrigez les informations bancaires."); return; }

    setSaving(true);
    try {
      await upsertFn({ data: {
        ...f,
        iban_ou_qr_iban: String(f.iban_ou_qr_iban).trim(),
        qr_iban: String(f.qr_iban || "").trim() || null,
        raison_sociale: f.raison_sociale || null,
        numero_ide: f.numero_ide || null,
        telephone: f.telephone || null,
        email_pro: f.email_pro || null,
        logo_url: f.logo_url || null,
        titulaire_nom: f.titulaire_nom || null,
        titulaire_adresse: f.titulaire_adresse || null,
        titulaire_npa: f.titulaire_npa || null,
        titulaire_ville: f.titulaire_ville || null,
        conditions_paiement: f.conditions_paiement || null,
        mention_tva: f.mention_tva || null,
        pied_de_page: f.pied_de_page || null,
        numero_tva: f.numero_tva || null,
        taux_tva: f.assujetti_tva ? Number(f.taux_tva) || 0 : null,
        delai_paiement_jours: Number(f.delai_paiement_jours) || 30,
        next_invoice_number: Number(f.next_invoice_number) || 1,
      } });
      toast.success("Paramètres enregistrés");
      await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setSaving(false); }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Paramètres de facturation</DialogTitle>
          <DialogDescription>
            Ces informations figurent sur chaque facture et alimentent la QR-facture.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Émetteur</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field state={f} set={set} k="raison_sociale" label="Raison sociale (sinon votre nom)" />
              <Field state={f} set={set} k="numero_ide" label="Numéro IDE" ph="CHE-123.456.789" />
              <Field state={f} set={set} k="telephone" label="Téléphone" />
              <Field state={f} set={set} k="email_pro" label="Email professionnel" type="email" />
              <Field state={f} set={set} k="adresse_rue" label="Rue *" error={miss("adresse_rue")} />
              <div className="grid grid-cols-3 gap-2">
                <Field state={f} set={set} k="adresse_npa" label="NPA *" error={miss("adresse_npa")} />
                <div className="col-span-2"><Field state={f} set={set} k="adresse_ville" label="Ville *" error={miss("adresse_ville")} /></div>
              </div>

              <Field state={f} set={set} k="adresse_pays" label="Pays" />
              <div className="sm:col-span-2">
                <InvoiceLogoUploader
                  value={f.logo_url ?? ""}
                  onChange={(v) => set("logo_url", v)}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Compte bancaire</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="set-iban">IBAN *</Label>
                <Input id="set-iban" value={f.iban_ou_qr_iban ?? ""} placeholder="CH93 0076 2011 6238 5295 7"
                  aria-invalid={!!ibanErr || miss("iban_ou_qr_iban")} onChange={(e) => set("iban_ou_qr_iban", e.target.value)} />
                {ibanErr
                  ? <p className="text-xs text-destructive">{ibanErr}</p>
                  : miss("iban_ou_qr_iban") && <p className="text-xs text-destructive">L'IBAN est obligatoire pour émettre des factures.</p>}

              </div>
              <div className="space-y-1">
                <Label htmlFor="set-qriban">QR-IBAN (si votre banque en fournit un)</Label>
                <Input id="set-qriban" value={f.qr_iban ?? ""} placeholder="CH44 3199 9123 0008 8901 2"
                  aria-invalid={!!qrIbanErr} onChange={(e) => set("qr_iban", e.target.value)} />
                {qrIbanErr
                  ? <p className="text-xs text-destructive">{qrIbanErr}</p>
                  : <p className="text-xs text-muted-foreground">Un QR-IBAN permet la référence QR structurée.</p>}
              </div>
              <Field state={f} set={set} k="titulaire_nom" label="Titulaire du compte" />
              <Field state={f} set={set} k="titulaire_adresse" label="Adresse du titulaire" />
              <div className="grid grid-cols-3 gap-2">
                <Field state={f} set={set} k="titulaire_npa" label="NPA" />
                <div className="col-span-2"><Field state={f} set={set} k="titulaire_ville" label="Ville" /></div>
              </div>
              <Field state={f} set={set} k="titulaire_pays" label="Pays du titulaire" />
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">TVA</legend>
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{VAT_WARNING}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="ass" checked={!!f.assujetti_tva} onCheckedChange={(v) => set("assujetti_tva", v)} />
              <Label htmlFor="ass">Je suis assujetti à la TVA</Label>
            </div>
            {f.assujetti_tva && (
              <div className="grid sm:grid-cols-3 gap-3">
                <Field state={f} set={set} k="numero_tva" label="Numéro TVA" ph="CHE-…-TVA" />
                <Field state={f} set={set} k="taux_tva" label="Taux par défaut (%)" type="number" />
                <div className="space-y-1">
                  <Label htmlFor="mode-tva">Mode de calcul</Label>
                  <Select value={f.mode_tva} onValueChange={(v) => set("mode_tva", v)}>
                    <SelectTrigger id="mode-tva"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exclusive">Prix hors TVA (TVA en sus)</SelectItem>
                      <SelectItem value="inclusive">Prix TVA incluse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <Field state={f} set={set} k="mention_tva" label="Mention TVA personnalisée" ph="Non assujetti à la TVA" />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Facturation</legend>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="devise">Devise par défaut</Label>
                <Select value={f.devise_defaut} onValueChange={(v) => set("devise_defaut", v)}>
                  <SelectTrigger id="devise"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field state={f} set={set} k="delai_paiement_jours" label="Délai de paiement (jours)" type="number" />
              <Field state={f} set={set} k="next_invoice_number" label="Prochain numéro" type="number" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rz" checked={!!f.remise_a_zero_annuelle}
                onCheckedChange={(v) => set("remise_a_zero_annuelle", v)} />
              <Label htmlFor="rz">Remise à zéro annuelle de la numérotation</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cond">Conditions de paiement</Label>
              <Textarea id="cond" rows={2} value={f.conditions_paiement ?? ""}
                onChange={(e) => set("conditions_paiement", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pdp">Texte légal / pied de page</Label>
              <Textarea id="pdp" rows={2} value={f.pied_de_page ?? ""}
                onChange={(e) => set("pied_de_page", e.target.value)} />
            </div>
          </fieldset>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button className="min-h-11" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Éditeur de facture (brouillon) ──────────────────────────────────

type EditLine = InvoiceLineInput & { remise_pct: number; tva_taux: number };

function InvoiceEditor({ invoiceId, contacts, vatRates, settings, onClose, onSaved }: {
  invoiceId: string | null;
  contacts: Contact[]; vatRates: VatRate[];
  settings: TherapistInvoiceSettings | null;
  onClose: () => void; onSaved: () => Promise<void>;
}) {
  const createFn = useServerFn(createInvoiceDraft);
  const updateFn = useServerFn(updateInvoiceDraft);
  const getFn = useServerFn(getTherapistInvoice);

  const defaultRate = settings?.assujetti_tva ? Number(settings.taux_tva ?? 0) : 0;
  const [f, setF] = useState<Record<string, any>>({
    client_id: "", client_nom: "", client_adresse: "", client_npa: "", client_ville: "",
    client_pays: "CH", client_email: "", currency: settings?.devise_defaut ?? "CHF",
    date_emission: new Date().toISOString().slice(0, 10),
    date_prestation: "", date_echeance: "", communication: "", notes: "",
  });
  const [lines, setLines] = useState<EditLine[]>([
    { description: "Séance", quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_taux: defaultRate },
  ]);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    if (!invoiceId) return;
    getFn({ data: { id: invoiceId } }).then(({ invoice, lines: ls }) => {
      setF({
        client_id: invoice.client_id ?? "", client_nom: invoice.client_nom ?? "",
        client_adresse: invoice.client_adresse ?? "", client_npa: invoice.client_npa ?? "",
        client_ville: invoice.client_ville ?? "", client_pays: invoice.client_pays ?? "CH",
        client_email: invoice.client_email ?? "", currency: invoice.currency,
        date_emission: invoice.date_emission?.slice(0, 10) ?? "",
        date_prestation: invoice.date_prestation ?? "",
        date_echeance: invoice.date_echeance ?? "",
        communication: invoice.communication ?? "", notes: invoice.notes ?? "",
      });
      if (ls.length) {
        setLines(ls.map((l: TherapistInvoiceLine) => ({
          description: l.description, quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_unitaire), remise_pct: Number(l.remise_pct),
          tva_taux: Number(l.tva_taux),
        })));
      }
    }).catch((e) => toast.error(e.message));
  }, [invoiceId, getFn]);

  useEffect(() => {
    if (!f.client_id) return;
    const c = contacts.find((x) => x.id === f.client_id);
    if (c) setF((s) => ({
      ...s,
      client_nom: s.client_nom || `${c.first_name} ${c.last_name}`.trim(),
      client_email: s.client_email || c.email || "",
    }));
  }, [f.client_id, contacts]);

  const totals = useMemo(
    () => computeInvoiceTotals(lines, settings?.mode_tva ?? "exclusive"),
    [lines, settings?.mode_tva],
  );

  const setLine = (i: number, k: keyof EditLine, v: any) =>
    setLines((s) => s.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  async function save() {
    if (!f.client_nom?.trim()) { toast.error("Nom du destinataire requis"); return; }
    if (!lines.length || lines.some((l) => !l.description.trim())) {
      toast.error("Chaque ligne doit avoir une description"); return;
    }
    setSaving(true);
    try {
      const payload = {
        client_id: f.client_id || null,
        client_nom: f.client_nom.trim(),
        client_adresse: f.client_adresse || null,
        client_npa: f.client_npa || null,
        client_ville: f.client_ville || null,
        client_pays: f.client_pays || "CH",
        client_email: f.client_email || null,
        date_emission: f.date_emission || null,
        date_prestation: f.date_prestation || null,
        date_echeance: f.date_echeance || null,
        currency: f.currency,
        reference_type: "none" as const,
        communication: f.communication || null,
        notes: f.notes || null,
        lines: lines.map((l) => ({
          description: l.description.trim(),
          quantite: Number(l.quantite) || 1,
          prix_unitaire: Number(l.prix_unitaire) || 0,
          remise_pct: Number(l.remise_pct) || 0,
          tva_taux: Number(l.tva_taux) || 0,
        })),
      };
      if (invoiceId) await updateFn({ data: { id: invoiceId, ...payload } });
      else await createFn({ data: payload });
      toast.success(invoiceId ? "Brouillon mis à jour" : "Brouillon créé");
      await onSaved();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{invoiceId ? "Modifier le brouillon" : "Nouvelle facture"}</DialogTitle>
          <DialogDescription>
            Le numéro définitif est attribué à la validation, jamais avant.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Destinataire</legend>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cl">Client CRM (optionnel)</Label>
                <Select value={f.client_id || "manual"}
                  onValueChange={(v) => set("client_id", v === "manual" ? "" : v)}>
                  <SelectTrigger id="cl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Saisie manuelle</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cn">Nom complet *</Label>
                <Input id="cn" value={f.client_nom} onChange={(e) => set("client_nom", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ca">Adresse</Label>
                <Input id="ca" value={f.client_adresse} onChange={(e) => set("client_adresse", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="cnpa">NPA</Label>
                  <Input id="cnpa" value={f.client_npa} onChange={(e) => set("client_npa", e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="cv">Ville</Label>
                  <Input id="cv" value={f.client_ville} onChange={(e) => set("client_ville", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ce">Email</Label>
                <Input id="ce" type="email" value={f.client_email} onChange={(e) => set("client_email", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cp">Pays</Label>
                <Input id="cp" value={f.client_pays} onChange={(e) => set("client_pays", e.target.value)} />
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">Dates et devise</legend>
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="de">Date d'émission</Label>
                <Input id="de" type="date" value={f.date_emission} onChange={(e) => set("date_emission", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dp">Date de prestation</Label>
                <Input id="dp" type="date" value={f.date_prestation} onChange={(e) => set("date_prestation", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dech">Échéance</Label>
                <Input id="dech" type="date" value={f.date_echeance} onChange={(e) => set("date_echeance", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cur">Devise</Label>
                <Select value={f.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger id="cur"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHF">CHF</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <div className="flex items-center justify-between">
              <legend className="text-sm font-semibold">Prestations</legend>
              <Button size="sm" variant="outline" className="min-h-11"
                onClick={() => setLines((s) => [...s, {
                  description: "", quantite: 1, prix_unitaire: 0, remise_pct: 0, tva_taux: defaultRate,
                }])}>
                <Plus className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> Ajouter une ligne
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-4 space-y-1">
                    <Label htmlFor={`ld-${i}`} className="text-xs">Description</Label>
                    <Input id={`ld-${i}`} value={l.description}
                      onChange={(e) => setLine(i, "description", e.target.value)} />
                  </div>
                  <div className="col-span-3 sm:col-span-1 space-y-1">
                    <Label htmlFor={`lq-${i}`} className="text-xs">Qté</Label>
                    <Input id={`lq-${i}`} type="number" min={0} step={0.5} value={l.quantite}
                      onChange={(e) => setLine(i, "quantite", Number(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-4 sm:col-span-2 space-y-1">
                    <Label htmlFor={`lp-${i}`} className="text-xs">Prix unitaire</Label>
                    <Input id={`lp-${i}`} type="number" min={0} step={0.05} value={l.prix_unitaire}
                      onChange={(e) => setLine(i, "prix_unitaire", Number(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-3 sm:col-span-1 space-y-1">
                    <Label htmlFor={`lr-${i}`} className="text-xs">Remise %</Label>
                    <Input id={`lr-${i}`} type="number" min={0} max={100} value={l.remise_pct}
                      onChange={(e) => setLine(i, "remise_pct", Number(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-9 sm:col-span-3 space-y-1">
                    <Label htmlFor={`lt-${i}`} className="text-xs">TVA</Label>
                    <Select value={String(l.tva_taux)} onValueChange={(v) => setLine(i, "tva_taux", Number(v))}>
                      <SelectTrigger id={`lt-${i}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(vatRates.length ? vatRates : [{ code: "none", label: "0 %", rate: 0, note: null }])
                          .map((r) => (
                            <SelectItem key={r.code} value={String(r.rate)}>{r.label}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 sm:col-span-1 flex justify-end">
                    <Button size="icon" variant="ghost" className="min-h-11 min-w-11"
                      aria-label={`Supprimer la ligne ${i + 1}`}
                      onClick={() => setLines((s) => s.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{VAT_WARNING}</p>
          </fieldset>

          <div className="space-y-1">
            <Label htmlFor="nt">Note sur la facture</Label>
            <Textarea id="nt" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="rounded-lg border border-border/60 p-4 text-sm space-y-1">
            {totals.montant_remise > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Remise</span><span>− {totals.montant_remise.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between"><span>Sous-total HT</span><span>{totals.montant_ht.toFixed(2)} {f.currency}</span></div>
            {totals.parTaux.filter((t) => t.taux > 0).map((t) => (
              <div key={t.taux} className="flex justify-between text-muted-foreground">
                <span>TVA {t.taux.toFixed(1)} %</span><span>{t.tva.toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-base pt-1 border-t border-border/60">
              <span>Total</span><span>{totals.montant_total.toFixed(2)} {f.currency}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={onClose}>Annuler</Button>
          <Button className="min-h-11" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer le brouillon"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Détail : validation, paiements, avoir, envoi ────────────────────

function InvoiceDetail({ id, onClose, onEdit, onChanged }: {
  id: string; onClose: () => void;
  onEdit: (id: string) => void; onChanged: () => Promise<void>;
}) {
  const getFn = useServerFn(getTherapistInvoice);
  const checkFn = useServerFn(checkInvoiceReadiness);
  const validateFn = useServerFn(validateInvoice);
  const dupFn = useServerFn(duplicateInvoice);
  const cancelFn = useServerFn(cancelInvoice);
  const creditFn = useServerFn(createCreditNote);
  const delFn = useServerFn(deleteTherapistInvoice);
  const renderFn = useServerFn(renderInvoiceHtml);
  const emailFn = useServerFn(emailInvoiceToClient);
  const payFn = useServerFn(addInvoicePayment);
  const delPayFn = useServerFn(deleteInvoicePayment);

  const [invoice, setInvoice] = useState<TherapistInvoice | null>(null);
  const [lines, setLines] = useState<TherapistInvoiceLine[]>([]);
  const [payments, setPayments] = useState<TherapistInvoicePayment[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pay, setPay] = useState({ montant: "", mode: "virement", ref: "", refund: false });

  const load = useCallback(async () => {
    const [d, r] = await Promise.all([getFn({ data: { id } }), checkFn({ data: { id } })]);
    setInvoice(d.invoice); setLines(d.lines); setPayments(d.payments); setErrors(r.errors);
  }, [id, getFn, checkFn]);

  useEffect(() => { load().catch((e) => toast.error(e.message)); }, [load]);

  async function run(label: string, fn: () => Promise<unknown>, close = false) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await onChanged();
      if (close) onClose(); else await load();
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setBusy(false); }
  }

  if (!invoice) {
    return (
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Chargement…</DialogTitle></DialogHeader>
          <div className="h-32 rounded-lg bg-muted animate-pulse" aria-busy="true" />
        </DialogContent>
      </Dialog>
    );
  }

  const locked = !!invoice.locked_at;
  const solde = round2(Number(invoice.montant_total) - Number(invoice.montant_paye ?? 0));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-base">{invoice.numero_facture}</span>
            <StatusBadge statut={invoice.statut} />
            {locked && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" aria-hidden="true" /> Verrouillée</Badge>}
          </DialogTitle>
          <DialogDescription>
            {invoice.client_nom} · Émise le {new Date(invoice.date_emission).toLocaleDateString("fr-CH")}
            {invoice.date_echeance ? ` · Échéance ${new Date(invoice.date_echeance).toLocaleDateString("fr-CH")}` : ""}
          </DialogDescription>
        </DialogHeader>

        {errors.length > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            <p className="font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> QR-facture indisponible
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs space-y-0.5">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}

        <section>
          <h3 className="text-sm font-semibold mb-2">Prestations</h3>
          <div className="overflow-x-auto rounded-lg border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th scope="col" className="text-left p-2">Description</th>
                  <th scope="col" className="text-right p-2">Qté</th>
                  <th scope="col" className="text-right p-2">P.U.</th>
                  <th scope="col" className="text-right p-2">TVA</th>
                  <th scope="col" className="text-right p-2">HT</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-t border-border/60">
                    <td className="p-2">{l.description}</td>
                    <td className="p-2 text-right">{Number(l.quantite)}</td>
                    <td className="p-2 text-right">{Number(l.prix_unitaire).toFixed(2)}</td>
                    <td className="p-2 text-right">{Number(l.tva_taux).toFixed(1)} %</td>
                    <td className="p-2 text-right">{Number(l.montant_ht).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span>Total : <strong>{Number(invoice.montant_total).toFixed(2)} {invoice.currency}</strong></span>
            <span>Payé : {Number(invoice.montant_paye ?? 0).toFixed(2)}</span>
            <span>Solde : <strong>{solde.toFixed(2)}</strong></span>
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <CreditCard className="h-4 w-4" aria-hidden="true" /> Paiements
          </h3>
          {payments.length === 0
            ? <p className="text-xs text-muted-foreground">Aucun encaissement enregistré.</p>
            : (
              <ul className="space-y-1 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between rounded border border-border/60 px-3 py-2">
                    <span>
                      {p.is_refund ? "Remboursement " : ""}{Number(p.montant).toFixed(2)} {invoice.currency} ·{" "}
                      {new Date(p.date_paiement).toLocaleDateString("fr-CH")} · {p.mode_paiement}
                      {p.reference_bancaire ? ` · ${p.reference_bancaire}` : ""}
                    </span>
                    <Button size="icon" variant="ghost" className="min-h-11 min-w-11"
                      aria-label="Supprimer cet encaissement" disabled={busy}
                      onClick={() => {
                        if (!confirm("Supprimer cet encaissement ?")) return;
                        run("Encaissement supprimé", () => delPayFn({ data: { id: p.id, invoice_id: invoice.id } }));
                      }}>
                      <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          {locked && invoice.statut !== "annulee" && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              <div className="space-y-1">
                <Label htmlFor="pm" className="text-xs">Montant</Label>
                <Input id="pm" type="number" min={0} step={0.05} value={pay.montant}
                  onChange={(e) => setPay((s) => ({ ...s, montant: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="pmode" className="text-xs">Mode</Label>
                <Select value={pay.mode} onValueChange={(v) => setPay((s) => ({ ...s, mode: v }))}>
                  <SelectTrigger id="pmode"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="carte">Carte</SelectItem>
                    <SelectItem value="twint">TWINT</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="pref" className="text-xs">Référence bancaire</Label>
                <Input id="pref" value={pay.ref} onChange={(e) => setPay((s) => ({ ...s, ref: e.target.value }))} />
              </div>
              <Button className="min-h-11" disabled={busy || !Number(pay.montant)}
                onClick={() => run("Encaissement enregistré", async () => {
                  await payFn({ data: {
                    invoice_id: invoice.id, montant: Number(pay.montant),
                    mode_paiement: pay.mode as any, reference_bancaire: pay.ref || null,
                    is_refund: pay.refund,
                  } });
                  setPay({ montant: "", mode: "virement", ref: "", refund: false });
                })}>
                Enregistrer
              </Button>
            </div>
          )}
        </section>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" className="min-h-11" disabled={busy}
            onClick={async () => {
              const { html } = await renderFn({ data: { id: invoice.id } });
              const w = window.open("", "_blank");
              if (!w) { toast.error("Fenêtre bloquée"); return; }
              w.document.write(html); w.document.close();
            }}>
            <Printer className="h-4 w-4 mr-2" aria-hidden="true" /> Aperçu / PDF
          </Button>

          {!locked && (
            <>
              <Button variant="outline" className="min-h-11" disabled={busy}
                onClick={() => onEdit(invoice.id)}>Modifier</Button>
              <Button variant="outline" className="min-h-11" disabled={busy}
                onClick={() => {
                  if (!confirm("Supprimer définitivement ce brouillon ?")) return;
                  run("Brouillon supprimé", () => delFn({ data: { id: invoice.id } }), true);
                }}>
                <Trash2 className="h-4 w-4 mr-2 text-destructive" aria-hidden="true" /> Supprimer
              </Button>
              <Button className="min-h-11" disabled={busy || errors.length > 0}
                onClick={() => {
                  if (!confirm("Valider cette facture ? Le numéro sera attribué et la facture ne pourra plus être modifiée.")) return;
                  run("Facture validée", () => validateFn({ data: { id: invoice.id } }));
                }}>
                <Lock className="h-4 w-4 mr-2" aria-hidden="true" /> Valider
              </Button>
            </>
          )}

          {locked && (
            <>
              <Button variant="outline" className="min-h-11" disabled={busy}
                onClick={() => run("Facture dupliquée", () => dupFn({ data: { id: invoice.id } }), true)}>
                <Copy className="h-4 w-4 mr-2" aria-hidden="true" /> Dupliquer
              </Button>
              <Button variant="outline" className="min-h-11" disabled={busy}
                onClick={() => {
                  const to = invoice.client_email
                    || prompt("Adresse email du destinataire ?") || "";
                  if (!to) return;
                  if (!confirm(`Envoyer la facture ${invoice.numero_facture} à ${to} ?`)) return;
                  run("Facture envoyée", () => emailFn({ data: { id: invoice.id, to } }));
                }}>
                <Mail className="h-4 w-4 mr-2" aria-hidden="true" /> Envoyer par email
              </Button>
              {invoice.statut !== "annulee" && (
                <Button variant="outline" className="min-h-11" disabled={busy}
                  onClick={() => {
                    const reason = prompt("Motif de l'annulation ?");
                    if (!reason) return;
                    run("Facture annulée", () => cancelFn({ data: { id: invoice.id, reason } }));
                  }}>
                  <Ban className="h-4 w-4 mr-2 text-destructive" aria-hidden="true" /> Annuler
                </Button>
              )}
              <Button variant="outline" className="min-h-11" disabled={busy}
                onClick={() => {
                  const reason = prompt("Motif de l'avoir ?");
                  if (!reason) return;
                  run("Avoir créé", () => creditFn({ data: { id: invoice.id, reason } }), true);
                }}>
                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" /> Créer un avoir
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
