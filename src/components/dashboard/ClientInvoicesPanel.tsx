// Onglet « Factures » de la fiche client : indicateurs, liste filtrable et détail
// ouvert sans quitter la fiche. Réutilise uniquement les fonctions therapist_invoices.

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  listMyTherapistInvoices, getTherapistInvoice, listInvoiceAudit, updateInvoiceDraft, validateInvoice,
  duplicateInvoice, cancelInvoice, createCreditNote, addInvoicePayment, emailInvoiceToClient,
  deleteTherapistInvoice,
} from "@/lib/therapist-invoices.functions";
import {
  allowedActions, balance, clientInvoiceStats, displayNumber, matchesFilter, statusLabel,
  type InvoiceFilter, type InvoiceRow,
} from "@/lib/client-invoice-ui";
import { InvoiceReminderButton } from "@/components/dashboard/ClientFicheExtras";

const FILTERS: { key: InvoiceFilter; label: string }[] = [
  { key: "toutes", label: "Toutes" },
  { key: "a_encaisser", label: "À encaisser" },
  { key: "payees", label: "Payées" },
  { key: "annulees", label: "Annulées / Avoirs" },
];

const AUDIT_LABEL: Record<string, string> = {
  draft_created: "Brouillon créé",
  draft_created_from_appointment: "Brouillon créé depuis un rendez-vous",
  draft_created_from_client: "Brouillon créé depuis la fiche client",
  draft_updated: "Brouillon modifié",
  invoice_validated: "Facture émise",
  payment_recorded: "Paiement enregistré",
  refund_recorded: "Remboursement enregistré",
  invoice_cancelled: "Facture annulée",
  credit_note_created: "Avoir créé",
  invoice_duplicated: "Facture dupliquée",
  invoice_emailed: "Facture envoyée",
  reminder_sent: "Rappel envoyé",
};

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function badgeVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "payee") return "default";
  if (s === "en_retard" || s === "en_litige" || s === "erreur_envoi") return "destructive";
  if (s === "brouillon" || s === "annulee" || s === "avoir") return "outline";
  return "secondary";
}

export function useMoney(currency: string) {
  return (n: number, c?: string | null) =>
    new Intl.NumberFormat("fr-CH", { style: "currency", currency: c || currency }).format(n);
}

/** Les quatre indicateurs de la vue d'ensemble, calculés depuis les factures réelles. */
export function ClientBillingStats({ clientId, currency }: { clientId: string; currency: string }) {
  const listFn = useServerFn(listMyTherapistInvoices);
  const money = useMoney(currency);
  const { data, isLoading } = useQuery({
    queryKey: ["client-invoices", clientId],
    queryFn: () => listFn({ data: { client_id: clientId } }),
  });
  if (isLoading) return <Skeleton className="h-20 w-full" />;
  const s = clientInvoiceStats((data ?? []) as InvoiceRow[]);
  const items = [
    { label: "Total facturé", value: money(s.facture) },
    { label: "Total encaissé", value: money(s.encaisse) },
    { label: "Solde dû", value: money(s.solde), alert: s.solde > 0 },
    { label: "Retards", value: String(s.retards), alert: s.retards > 0 },
  ];
  return (
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Indicateurs de facturation">
      {items.map((i) => (
        <div key={i.label} className="rounded-lg border border-border p-3">
          <div className="text-xs text-muted-foreground">{i.label}</div>
          <div className={`text-lg font-semibold ${i.alert ? "text-destructive" : ""}`}>{i.value}</div>
        </div>
      ))}
    </section>
  );
}

export function ClientInvoicesPanel({ client, currency }: { client: any; currency: string }) {
  const listFn = useServerFn(listMyTherapistInvoices);
  const money = useMoney(currency);
  const [filter, setFilter] = useState<InvoiceFilter>("toutes");
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["client-invoices", client.id],
    queryFn: () => listFn({ data: { client_id: client.id } }),
  });
  const rows = ((data ?? []) as InvoiceRow[]).filter((i) => matchesFilter(i, filter));

  return (
    <section className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Receipt className="h-4 w-4" aria-hidden="true" /> Factures
        </h3>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrer les factures">
          {FILTERS.map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} className="min-h-9"
              aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className="h-24 w-full" />}
      {!isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Aucune facture dans cette catégorie.</p>
      )}
      {!isLoading && rows.length > 0 && (
        <ul className="divide-y divide-border">
          {rows.map((i) => (
            <li key={i.id} className="py-2">
              <button type="button" onClick={() => setOpenId(i.id)}
                className="w-full text-left rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{displayNumber(i)}</span>
                  <Badge variant={badgeVariant(i.statut)}>{statusLabel(i.statut)}</Badge>
                </div>
                <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-1 text-xs text-muted-foreground">
                  <span>Émise {fmtDate(i.date_emission)}</span>
                  <span>Échéance {fmtDate(i.date_echeance)}</span>
                  <span className="text-foreground">{money(Number(i.montant_total), i.currency)}</span>
                  <span className={balance(i) > 0 ? "text-destructive" : ""}>Solde {money(balance(i), i.currency)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && <InvoiceDetailDialog id={openId} client={client} currency={currency} onClose={() => setOpenId(null)} />}
    </section>
  );
}

type Confirm = null | "delete" | "cancel" | "credit" | "validate" | "pay" | "send" | "edit";

function InvoiceDetailDialog({ id, client, currency, onClose }: { id: string; client: any; currency: string; onClose: () => void }) {
  const qc = useQueryClient();
  const money = useMoney(currency);
  const getFn = useServerFn(getTherapistInvoice);
  const auditFn = useServerFn(listInvoiceAudit);
  const fns = {
    update: useServerFn(updateInvoiceDraft), validate: useServerFn(validateInvoice),
    duplicate: useServerFn(duplicateInvoice), cancel: useServerFn(cancelInvoice),
    credit: useServerFn(createCreditNote), pay: useServerFn(addInvoicePayment),
    send: useServerFn(emailInvoiceToClient), del: useServerFn(deleteTherapistInvoice),
  };
  const { data, isLoading } = useQuery({ queryKey: ["therapist-invoice", id], queryFn: () => getFn({ data: { id } }) });
  const { data: audit = [] } = useQuery({ queryKey: ["therapist-invoice-audit", id], queryFn: () => auditFn({ data: { id } }) });

  const [confirm, setConfirm] = useState<Confirm>(null);
  const [reason, setReason] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<"especes" | "twint" | "carte" | "virement" | "autre" | "">("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [editLines, setEditLines] = useState<any[]>([]);

  const refresh = () => {
    for (const k of ["client-invoices", "therapist-invoice", "therapist-invoice-audit", "cabinet-client", "cabinet-clients", "therapist-invoices", "client-journal"]) {
      void qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const act = useMutation({
    mutationFn: async (kind: Exclude<Confirm, null> | "duplicate") => {
      const inv: any = data!.invoice;
      switch (kind) {
        case "delete": return fns.del({ data: { id } });
        case "cancel": return fns.cancel({ data: { id, reason } });
        case "credit": return fns.credit({ data: { id, reason } });
        case "validate": return fns.validate({ data: { id } });
        case "duplicate": return fns.duplicate({ data: { id } });
        case "send": return fns.send({ data: { id, to: client.email ?? null } });
        case "pay": return fns.pay({ data: { invoice_id: id, montant: Number(payAmount.replace(",", ".")), mode_paiement: payMode as any, date_paiement: payDate } });
        case "edit": return fns.update({
          data: {
            id, client_id: inv.client_id, client_nom: inv.client_nom || "Client",
            client_email: inv.client_email || null, client_adresse: inv.client_adresse, client_npa: inv.client_npa,
            client_ville: inv.client_ville, client_pays: inv.client_pays || "CH", currency: inv.currency || "CHF",
            reference_type: inv.reference_type || "none",
            lines: editLines.map((l) => ({
              description: String(l.description).trim(), quantite: Number(l.quantite), prix_unitaire: Number(l.prix_unitaire),
              remise_pct: Number(l.remise_pct ?? 0), tva_taux: Number(l.tva_taux ?? 0),
              date_prestation: l.date_prestation ?? null, appointment_id: l.appointment_id ?? null,
              tariff_system: l.tariff_system ?? null, tariff_code: l.tariff_code ?? null, tariff_label: l.tariff_label ?? null,
              tariff_version: l.tariff_version ?? null, duree_min: l.duree_min ?? null,
            })),
          } as any,
        });
      }
    },
    onSuccess: (_r, kind) => {
      const msg: Record<string, string> = {
        delete: "Brouillon supprimé", cancel: "Facture annulée", credit: "Avoir créé", validate: "Facture émise",
        duplicate: "Copie créée en brouillon", send: "Facture envoyée", pay: "Paiement enregistré", edit: "Brouillon enregistré",
      };
      toast.success(msg[kind] ?? "Fait");
      setConfirm(null); setReason("");
      refresh();
      if (kind === "delete") onClose();
    },
    onError: (e: any) => toast.error(String(e?.message ?? "Action impossible").slice(0, 200)),
  });

  const inv: any = data?.invoice;
  const payments = data?.payments ?? [];
  const actions = inv ? allowedActions(inv, payments.length > 0) : [];
  const busy = act.isPending;
  const solde = inv ? balance(inv) : 0;

  const open = (c: Exclude<Confirm, null>) => {
    if (c === "pay") { setPayAmount(String(solde)); setPayMode(""); }
    if (c === "edit") setEditLines((data?.lines ?? []).map((l: any) => ({ ...l })));
    setConfirm(c);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{inv ? `Facture ${displayNumber(inv)}` : "Facture"}</DialogTitle>
        </DialogHeader>
        {isLoading || !inv ? <Skeleton className="h-40 w-full" /> : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><div className="text-xs text-muted-foreground">Statut</div><Badge variant={badgeVariant(inv.statut)}>{statusLabel(inv.statut)}</Badge></div>
              <div><div className="text-xs text-muted-foreground">Émise</div>{fmtDate(inv.date_emission)}</div>
              <div><div className="text-xs text-muted-foreground">Total</div>{money(Number(inv.montant_total), inv.currency)}</div>
              <div><div className="text-xs text-muted-foreground">Solde</div><span className={solde > 0 ? "text-destructive" : ""}>{money(solde, inv.currency)}</span></div>
            </div>

            <section>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Lignes</h4>
              <ul className="divide-y divide-border">
                {(data?.lines ?? []).map((l: any) => (
                  <li key={l.id} className="flex justify-between gap-2 py-1.5">
                    <span className="min-w-0 break-words">{l.quantite} × {l.description}{l.tariff_code ? ` · Tarif 590 ${l.tariff_code}` : ""}</span>
                    <span className="shrink-0">{money(Number(l.montant_ttc), inv.currency)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Paiements</h4>
              {payments.length === 0 ? <p className="text-xs text-muted-foreground">Aucun paiement.</p> : (
                <ul className="divide-y divide-border">
                  {payments.map((p: any) => (
                    <li key={p.id} className="flex justify-between gap-2 py-1.5">
                      <span>{fmtDate(p.date_paiement)} · {p.mode_paiement}</span>
                      <span className={p.is_refund ? "text-destructive" : ""}>{p.is_refund ? "−" : ""}{money(Number(p.montant), inv.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">Historique</h4>
              {audit.length === 0 ? <p className="text-xs text-muted-foreground">Aucun événement.</p> : (
                <ul className="space-y-1 text-xs">
                  {audit.map((a) => (
                    <li key={a.id}>{new Date(a.created_at).toLocaleString("fr-CH")} — {AUDIT_LABEL[a.action] ?? a.action}{a.note ? ` (${a.note})` : ""}</li>
                  ))}
                </ul>
              )}
            </section>

            {confirm === null && (
              <div className="flex flex-wrap gap-2">
                {actions.includes("edit") && <Button variant="outline" className="min-h-11" onClick={() => open("edit")}>Modifier</Button>}
                {actions.includes("validate") && <Button className="min-h-11" onClick={() => open("validate")}>Valider et émettre</Button>}
                {actions.includes("pay") && <Button className="min-h-11" onClick={() => open("pay")}>Enregistrer un paiement</Button>}
                {actions.includes("send") && <Button variant="outline" className="min-h-11" disabled={!client.email} onClick={() => open("send")}>Envoyer</Button>}
                {actions.includes("remind") && <InvoiceReminderButton invoice={{ ...inv, solde }} client={client} />}
                {actions.includes("duplicate") && <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => act.mutate("duplicate")}>Dupliquer</Button>}
                {actions.includes("cancel") && <Button variant="outline" className="min-h-11" onClick={() => open("cancel")}>Annuler la facture</Button>}
                {actions.includes("credit") && <Button variant="outline" className="min-h-11" onClick={() => open("credit")}>Créer un avoir</Button>}
                {actions.includes("delete") && <Button variant="destructive" className="min-h-11" onClick={() => open("delete")}>Supprimer le brouillon</Button>}
              </div>
            )}

            {confirm && (
              <section className="rounded-lg border border-primary/50 p-3 space-y-3">
                {confirm === "delete" && <p>Supprimer définitivement ce brouillon ? Il n'a jamais été émis ni payé.</p>}
                {confirm === "validate" && <p>Émettre la facture ? Elle recevra un numéro définitif et ne pourra plus être modifiée (seulement annulée ou corrigée par un avoir).</p>}
                {confirm === "send" && <p>Envoyer la facture à <strong>{client.email}</strong> ?</p>}
                {(confirm === "cancel" || confirm === "credit") && (
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-reason">{confirm === "cancel" ? "Motif de l'annulation" : "Motif de l'avoir"}</Label>
                    <Textarea id="inv-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
                  </div>
                )}
                {confirm === "pay" && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-amount">Montant</Label>
                      <Input id="pay-amount" type="number" inputMode="decimal" min={0} step="0.05" className="min-h-11"
                        value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-mode">Moyen</Label>
                      <Select value={payMode} onValueChange={(v) => setPayMode(v as any)}>
                        <SelectTrigger id="pay-mode" className="min-h-11"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="especes">Espèces</SelectItem>
                          <SelectItem value="twint">TWINT</SelectItem>
                          <SelectItem value="carte">Carte</SelectItem>
                          <SelectItem value="virement">Virement</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pay-date">Date</Label>
                      <Input id="pay-date" type="date" className="min-h-11" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                    </div>
                  </div>
                )}
                {confirm === "edit" && (
                  <div className="space-y-2">
                    {editLines.map((l, idx) => (
                      <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Input aria-label={`Description ligne ${idx + 1}`} className="col-span-2 min-h-11" value={l.description}
                          onChange={(e) => setEditLines((ls) => ls.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
                        <Input aria-label={`Quantité ligne ${idx + 1}`} type="number" className="min-h-11" value={l.quantite}
                          onChange={(e) => setEditLines((ls) => ls.map((x, i) => i === idx ? { ...x, quantite: e.target.value } : x))} />
                        <Input aria-label={`Prix ligne ${idx + 1}`} type="number" className="min-h-11" value={l.prix_unitaire}
                          onChange={(e) => setEditLines((ls) => ls.map((x, i) => i === idx ? { ...x, prix_unitaire: e.target.value } : x))} />
                      </div>
                    ))}
                  </div>
                )}
                <DialogFooter className="gap-2">
                  <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setConfirm(null)}>Retour</Button>
                  <Button
                    variant={confirm === "delete" ? "destructive" : "default"} className="min-h-11"
                    disabled={busy
                      || ((confirm === "cancel" || confirm === "credit") && reason.trim().length < 3)
                      || (confirm === "pay" && (!payMode || !payDate || !(Number(payAmount.replace(",", ".")) > 0)))}
                    onClick={() => act.mutate(confirm)}>
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Confirmer
                  </Button>
                </DialogFooter>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
