import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { invoiceAppointment, settleAppointment, createClientInvoiceFn } from "@/lib/cabinet.functions";
import { listMyBillingServices, listTariffPositions } from "@/lib/billing-services.functions";
import { lineTotal, linesValid, settleReady } from "@/lib/client-invoice-ui";

export type QuickInvoiceTarget = {
  id: string;
  client_name: string;
  date: string | null;
  time: string | null;
  service: string | null;
  duration_minutes: number;
  suggested_price: number;
  suggested_vat: number;
};

export type QuickInvoiceClient = { id: string; name: string; currency?: string | null };

const PAYMENT_MODES = [
  { value: "especes", label: "Espèces" },
  { value: "twint", label: "TWINT" },
  { value: "carte", label: "Carte" },
  { value: "virement", label: "Virement" },
  { value: "autre", label: "Autre" },
] as const;
type PayMode = (typeof PAYMENT_MODES)[number]["value"];

type Line = {
  key: string;
  serviceId: string;
  positionId: string;
  description: string;
  quantite: string;
  prix: string;
  tva: string;
  duree: number | null;
};

const num = (s: string) => Number(String(s).replace(",", "."));
const today = () => new Date().toISOString().slice(0, 10);
const newKey = () => Math.random().toString(36).slice(2);

/**
 * Création de facture réutilisée partout : depuis un rendez-vous (agenda, fiche)
 * ou librement depuis la fiche client (sans rendez-vous). Une ou plusieurs lignes,
 * brouillon, émission, ou émission + encaissement avec moyen et date confirmés.
 */
export function QuickInvoiceDialog({
  appointment,
  client,
  open,
  onOpenChange,
  onCreated,
}: {
  appointment: QuickInvoiceTarget | null;
  client?: QuickInvoiceClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (invoiceId: string) => void;
}) {
  const queryClient = useQueryClient();
  const createLegacy = useServerFn(invoiceAppointment);
  const settleLegacy = useServerFn(settleAppointment);
  const createForClient = useServerFn(createClientInvoiceFn);
  const fetchServices = useServerFn(listMyBillingServices);
  const fetchPositions = useServerFn(listTariffPositions);

  // Sans client connu (ex. agenda), on garde le chemin historique « une séance, une ligne ».
  const clientMode = !!client?.id;
  const currency = client?.currency || "CHF";

  const [lines, setLines] = useState<Line[]>([]);
  const [reimbursable, setReimbursable] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const [mode, setMode] = useState<PayMode | "">("");
  const [payDate, setPayDate] = useState(today());
  const [confirmed, setConfirmed] = useState(false);
  const requestId = useRef<string>("");
  const inFlight = useRef(false);

  const { data: services = [] } = useQuery({
    queryKey: ["billing-services"], queryFn: () => fetchServices(), enabled: open, staleTime: 60_000,
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["tariff-positions"], queryFn: () => fetchPositions({ data: {} }), enabled: open, staleTime: 300_000,
  });

  useEffect(() => {
    if (!open) return;
    const desc = appointment
      ? `${appointment.service ?? "Séance"}${appointment.date ? ` — ${appointment.date}` : ""}${appointment.duration_minutes ? ` (${appointment.duration_minutes} min)` : ""}`
      : "";
    setLines([{
      key: newKey(), serviceId: "none", positionId: "none", description: desc, quantite: "1",
      prix: appointment?.suggested_price ? String(appointment.suggested_price) : "",
      tva: String(appointment?.suggested_vat ?? 0), duree: appointment?.duration_minutes ?? null,
    }]);
    setReimbursable(false);
    setSettleOpen(false);
    setMode("");
    setPayDate(today());
    setConfirmed(false);
    requestId.current = crypto.randomUUID();
    inFlight.current = false;
  }, [open, appointment]);

  const patch = (key: string, p: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));

  const applyService = (key: string, id: string) => {
    const svc = services.find((s) => s.id === id);
    patch(key, svc
      ? {
          serviceId: id, description: svc.name, prix: String(svc.price ?? 0), tva: String(svc.vat_rate ?? 0),
          duree: (svc as any).duration_minutes ?? null,
          ...(svc.tariff_position_id ? { positionId: svc.tariff_position_id } : {}),
        }
      : { serviceId: "none" });
  };

  const parsed = lines.map((l) => ({
    description: (l.description || "").trim(),
    quantite: num(l.quantite) || 0,
    prix_unitaire: num(l.prix),
    tva_taux: num(l.tva) || 0,
  }));
  const valid = linesValid(parsed);
  const total = parsed.reduce((s, l) => s + (Number.isFinite(l.prix_unitaire) ? lineTotal(l) : 0), 0);
  const fmt = (n: number) => new Intl.NumberFormat("fr-CH", { style: "currency", currency }).format(n);

  const payload = () =>
    lines.map((l, i) => {
      const pos = positions.find((p) => p.id === l.positionId);
      let description = parsed[i]!.description;
      if (i === 0 && reimbursable) description = `${description} · Facture pour remboursement assurance complémentaire`;
      return {
        description: description.slice(0, 500),
        quantite: parsed[i]!.quantite,
        prix_unitaire: parsed[i]!.prix_unitaire,
        tva_taux: parsed[i]!.tva_taux,
        duree_min: l.duree,
        tariff_code: pos?.code ?? null,
        tariff_label: pos?.designation ?? null,
      };
    });

  const refresh = () => {
    for (const k of ["uninvoiced-appointments", "cabinet-overview", "therapist-invoices", "cabinet-client",
      "cabinet-clients", "cabinet-stats", "client-invoices", "clients-to-bill", "appointments-to-bill"]) {
      void queryClient.invalidateQueries({ queryKey: [k] });
    }
  };

  const mutation = useMutation({
    mutationFn: async (action: "draft" | "issue" | "settle") => {
      if (inFlight.current) throw new Error("Création déjà en cours.");
      inFlight.current = true;
      const payment = action === "settle" ? { mode: mode as PayMode, date: payDate } : null;
      if (clientMode) {
        const res = await createForClient({
          data: {
            client_id: client!.id, appointment_id: appointment?.id ?? null,
            request_id: requestId.current, action, payment, lines: payload(),
          },
        });
        return { id: res.invoice_id, numero: res.numero_facture, action };
      }
      if (!appointment) throw new Error("Rendez-vous introuvable.");
      const first = payload()[0]!;
      if (action === "settle") {
        const res = await settleLegacy({
          data: {
            appointment_id: appointment.id, prix_unitaire: first.prix_unitaire, tva_taux: first.tva_taux,
            mode_paiement: payment!.mode, date_paiement: payment!.date, description: first.description,
          },
        });
        return { id: res.invoice_id, numero: res.numero_facture, action };
      }
      const res = await createLegacy({
        data: { appointment_id: appointment.id, prix_unitaire: first.prix_unitaire, tva_taux: first.tva_taux, description: first.description },
      });
      return { id: res.id, numero: null as string | null, action };
    },
    onSuccess: (res) => {
      refresh();
      onOpenChange(false);
      toast.success(
        res.action === "settle" ? `Facture ${res.numero ?? ""} créée et encaissée`.replace("  ", " ")
          : res.action === "issue" ? `Facture ${res.numero ?? ""} créée`.replace("  ", " ")
          : "Brouillon de facture enregistré",
      );
      onCreated?.(res.id);
    },
    onError: (e: Error) => {
      inFlight.current = false;
      toast.error(e.message || "Facturation impossible");
    },
  });

  const busy = mutation.isPending;
  const subtitle = appointment
    ? `${client?.name ?? appointment.client_name} · ${appointment.date ?? "—"}${appointment.time ? ` à ${appointment.time}` : ""}`
    : client?.name ?? "";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="flex max-w-2xl max-h-[90dvh] flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>{appointment ? "Facturer la séance" : "Créer une facture"}</DialogTitle>
          <DialogDescription className="break-words">{subtitle}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-y-auto space-y-4">
          {lines.map((l, idx) => {
            const p = parsed[idx]!;
            return (
              <fieldset key={l.key} className="min-w-0 rounded-lg border border-border/60 p-3 space-y-3">
                <legend className="px-1 text-xs text-muted-foreground">Ligne {idx + 1}</legend>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`qi-svc-${l.key}`}>Prestation</Label>
                    <Select value={l.serviceId} onValueChange={(v) => applyService(l.key, v)}>
                      <SelectTrigger id={`qi-svc-${l.key}`} className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Saisie libre</SelectItem>
                        {services.filter((s) => s.is_active).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name} — {s.price} {s.currency}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`qi-pos-${l.key}`}>Tarif 590 (facultatif)</Label>
                    <Select value={l.positionId} onValueChange={(v) => patch(l.key, { positionId: v })}>
                      <SelectTrigger id={`qi-pos-${l.key}`} className="min-h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sans code tarifaire</SelectItem>
                        {positions.map((ps) => (
                          <SelectItem key={ps.id} value={ps.id}>{ps.code} — {ps.designation}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`qi-desc-${l.key}`}>Description</Label>
                  <Input id={`qi-desc-${l.key}`} className="min-h-11" value={l.description} maxLength={500}
                    onChange={(e) => patch(l.key, { description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor={`qi-qty-${l.key}`}>Quantité</Label>
                    <Input id={`qi-qty-${l.key}`} type="number" inputMode="decimal" min={0} step="0.25"
                      className="min-h-11" value={l.quantite} onChange={(e) => patch(l.key, { quantite: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`qi-price-${l.key}`}>Prix unitaire</Label>
                    <Input id={`qi-price-${l.key}`} type="number" inputMode="decimal" min={0} step="0.05"
                      className="min-h-11" value={l.prix} onChange={(e) => patch(l.key, { prix: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`qi-vat-${l.key}`}>TVA (%)</Label>
                    <Input id={`qi-vat-${l.key}`} type="number" inputMode="decimal" min={0} step="0.1"
                      className="min-h-11" value={l.tva} onChange={(e) => patch(l.key, { tva: e.target.value })} />
                  </div>
                  <div className="flex items-center justify-between gap-2 min-h-11">
                    <span className="text-sm font-medium">{fmt(Number.isFinite(p.prix_unitaire) ? lineTotal(p) : 0)}</span>
                    {lines.length > 1 && (
                      <Button type="button" size="icon" variant="ghost" className="h-11 w-11"
                        aria-label={`Supprimer la ligne ${idx + 1}`}
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>
              </fieldset>
            );
          })}

          {clientMode && (
            <Button type="button" variant="outline" className="min-h-11" disabled={lines.length >= 30}
              onClick={() => setLines((ls) => [...ls, {
                key: newKey(), serviceId: "none", positionId: "none", description: "", quantite: "1", prix: "", tva: "0", duree: null,
              }])}>
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" /> Ajouter une ligne
            </Button>
          )}
          {services.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucune prestation enregistrée : créez-les dans Facturation › Prestations.</p>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="pr-3">
              <Label htmlFor="qi-reimb" className="text-sm">Facture pour remboursement</Label>
              <p className="text-xs text-muted-foreground">
                Ajoute la mention « assurance complémentaire ». Le Tarif 590 ne garantit pas le remboursement.
              </p>
            </div>
            <Switch id="qi-reimb" checked={reimbursable} onCheckedChange={setReimbursable} />
          </div>

          <p className="text-sm text-muted-foreground">
            Total estimé : <strong className="text-foreground">{fmt(total)}</strong>
          </p>

          {settleOpen && (
            <section className="rounded-lg border border-primary/50 p-3 space-y-3" aria-label="Confirmation de l'encaissement">
              <p className="text-sm font-medium">Confirmer l'encaissement</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="qi-mode">Moyen de paiement</Label>
                  <Select value={mode} onValueChange={(v) => { setMode(v as PayMode); setConfirmed(false); }}>
                    <SelectTrigger id="qi-mode" className="min-h-11"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qi-paydate">Date du paiement</Label>
                  <Input id="qi-paydate" type="date" className="min-h-11" value={payDate} max={today()}
                    onChange={(e) => { setPayDate(e.target.value); setConfirmed(false); }} />
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} className="mt-0.5" />
                <span>
                  Je confirme avoir reçu {fmt(total)}
                  {mode ? ` par ${PAYMENT_MODES.find((m) => m.value === mode)?.label}` : ""}
                  {payDate ? ` le ${new Date(payDate).toLocaleDateString("fr-CH")}` : ""}.
                </span>
              </label>
            </section>
          )}
        </div>

        <DialogFooter className="shrink-0 max-h-[45dvh] overflow-y-auto flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => onOpenChange(false)}>Annuler</Button>
          {!settleOpen && (
            <>
              <Button variant="outline" className="min-h-11" disabled={!valid || busy} onClick={() => mutation.mutate("draft")}>
                Enregistrer comme brouillon
              </Button>
              {clientMode && (
                <Button variant="secondary" className="min-h-11" disabled={!valid || busy} onClick={() => mutation.mutate("issue")}>
                  Créer sans encaisser
                </Button>
              )}
              <Button className="min-h-11" disabled={!valid || busy} onClick={() => setSettleOpen(true)}>
                Créer et encaisser
              </Button>
            </>
          )}
          {settleOpen && (
            <>
              <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => setSettleOpen(false)}>Retour</Button>
              <Button className="min-h-11" disabled={!valid || busy || !settleReady(mode, payDate, confirmed)}
                onClick={() => mutation.mutate("settle")}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Confirmer : créer et encaisser
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickInvoiceDialog;
