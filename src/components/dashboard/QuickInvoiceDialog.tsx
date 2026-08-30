import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { invoiceAppointment, settleAppointment } from "@/lib/cabinet.functions";
import { listMyBillingServices, listTariffPositions } from "@/lib/billing-services.functions";

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

const PAYMENT_MODES = [
  { value: "especes", label: "Espèces" },
  { value: "twint", label: "TWINT" },
  { value: "carte", label: "Carte" },
  { value: "virement", label: "Virement" },
  { value: "autre", label: "Autre" },
] as const;

/**
 * Assistant « facturer une séance » : prestation du catalogue, position Tarif 590
 * facultative, mention de remboursement, puis brouillon ou encaissement direct.
 * Aucun champ n'est fictif : tout est transmis aux fonctions serveur existantes.
 */
export function QuickInvoiceDialog({
  appointment,
  open,
  onOpenChange,
  onCreated,
}: {
  appointment: QuickInvoiceTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (invoiceId: string) => void;
}) {
  const queryClient = useQueryClient();
  const createInvoice = useServerFn(invoiceAppointment);
  const settle = useServerFn(settleAppointment);
  const fetchServices = useServerFn(listMyBillingServices);
  const fetchPositions = useServerFn(listTariffPositions);

  const [serviceId, setServiceId] = useState("none");
  const [positionId, setPositionId] = useState("none");
  const [price, setPrice] = useState("");
  const [vat, setVat] = useState("0");
  const [reimbursable, setReimbursable] = useState(false);
  const [paid, setPaid] = useState(false);
  const [mode, setMode] = useState<(typeof PAYMENT_MODES)[number]["value"]>("especes");

  const { data: services = [] } = useQuery({
    queryKey: ["billing-services"],
    queryFn: () => fetchServices(),
    enabled: open,
    staleTime: 60_000,
  });
  const { data: positions = [] } = useQuery({
    queryKey: ["tariff-positions"],
    queryFn: () => fetchPositions({ data: {} }),
    enabled: open,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!open || !appointment) return;
    setServiceId("none");
    setPositionId("none");
    setPrice(appointment.suggested_price ? String(appointment.suggested_price) : "");
    setVat(String(appointment.suggested_vat ?? 0));
    setReimbursable(false);
    setPaid(false);
    setMode("especes");
  }, [open, appointment]);

  const chosenService = services.find((s) => s.id === serviceId);
  const chosenPosition = positions.find((p) => p.id === positionId);

  const applyService = (id: string) => {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setPrice(String(svc.price ?? 0));
      setVat(String(svc.vat_rate ?? 0));
      if (svc.tariff_position_id) setPositionId(svc.tariff_position_id);
    }
  };

  const description = useMemo(() => {
    if (!appointment) return "";
    const base =
      chosenService?.name
      || appointment.service
      || "Séance";
    const parts = [
      `${base} — ${appointment.date ?? ""}`.trim(),
      appointment.duration_minutes ? `(${appointment.duration_minutes} min)` : "",
      chosenPosition ? `· Tarif 590 ${chosenPosition.code}` : "",
      reimbursable ? "· Facture pour remboursement assurance complémentaire" : "",
    ].filter(Boolean);
    return parts.join(" ").slice(0, 500);
  }, [appointment, chosenService, chosenPosition, reimbursable]);

  const parsedPrice = Number(price.replace(",", "."));
  const parsedVat = Number(vat.replace(",", ".")) || 0;
  const valid = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const total = valid ? parsedPrice * (1 + parsedVat / 100) : 0;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["uninvoiced-appointments"] });
    void queryClient.invalidateQueries({ queryKey: ["cabinet-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["therapist-invoices"] });
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!appointment) throw new Error("Rendez-vous introuvable.");
      if (paid) {
        const res = await settle({
          data: {
            appointment_id: appointment.id,
            prix_unitaire: parsedPrice,
            tva_taux: parsedVat,
            mode_paiement: mode,
            description,
          },
        });
        return { id: res.invoice_id, numero: res.numero_facture, settled: true };
      }
      const res = await createInvoice({
        data: {
          appointment_id: appointment.id,
          prix_unitaire: parsedPrice,
          tva_taux: parsedVat,
          description,
        },
      });
      return { id: res.id, numero: null as string | null, settled: false };
    },
    onSuccess: (res) => {
      refresh();
      onOpenChange(false);
      toast.success(
        res.settled
          ? res.numero
            ? `Séance encaissée — facture ${res.numero}`
            : "Séance encaissée"
          : "Brouillon de facture créé",
      );
      if (!res.settled) onCreated?.(res.id);
    },
    onError: (e: Error) => toast.error(e.message || "Facturation impossible"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Facturer la séance</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.client_name} · ${appointment.date ?? "—"}${appointment.time ? ` à ${appointment.time}` : ""}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qi-service">Prestation</Label>
            <Select value={serviceId} onValueChange={applyService}>
              <SelectTrigger id="qi-service" className="min-h-11">
                <SelectValue placeholder="Séance (libellé du rendez-vous)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Séance (libellé du rendez-vous)</SelectItem>
                {services
                  .filter((s) => s.is_active)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} — {s.price} {s.currency}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {services.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucune prestation enregistrée : créez-les dans l'onglet « Prestations ».
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qi-position">Position Tarif 590 (facultatif)</Label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger id="qi-position" className="min-h-11">
                <SelectValue placeholder="Sans code tarifaire" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sans code tarifaire</SelectItem>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.code} — {p.designation}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {positions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Aucun catalogue Tarif 590 importé pour l'instant.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qi-price">Montant HT</Label>
              <Input
                id="qi-price"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.05"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-invalid={!valid}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qi-vat">TVA (%)</Label>
              <Input
                id="qi-vat"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="pr-3">
              <Label htmlFor="qi-reimb" className="text-sm">Facture pour remboursement</Label>
              <p className="text-xs text-muted-foreground">
                Ajoute la mention « remboursement assurance complémentaire » sur la facture.
              </p>
            </div>
            <Switch id="qi-reimb" checked={reimbursable} onCheckedChange={setReimbursable} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
            <div className="pr-3">
              <Label htmlFor="qi-paid" className="text-sm">Séance déjà réglée</Label>
              <p className="text-xs text-muted-foreground">
                Valide la facture (numéro définitif) et enregistre l'encaissement complet.
              </p>
            </div>
            <Switch id="qi-paid" checked={paid} onCheckedChange={setPaid} />
          </div>

          {paid && (
            <div className="space-y-1.5">
              <Label htmlFor="qi-mode">Mode de paiement</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger id="qi-mode" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Total TTC estimé : <strong className="text-foreground">{total.toFixed(2)} CHF</strong>
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            className="min-h-11"
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {paid ? "Encaisser la séance" : "Créer la facture"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default QuickInvoiceDialog;
