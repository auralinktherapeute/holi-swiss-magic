import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Receipt, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listUninvoicedAppointments, invoiceAppointment, dismissAppointmentInvoicing,
} from "@/lib/cabinet.functions";

/**
 * « Factures manquantes » : rendez-vous honorés sans facture. Un clic crée un
 * brouillon conforme (ligne pré-remplie, TVA des réglages) et ouvre la facture.
 */
export function MissingInvoices() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchList = useServerFn(listUninvoicedAppointments);
  const createInvoice = useServerFn(invoiceAppointment);
  const dismiss = useServerFn(dismissAppointmentInvoicing);

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [pendingSkip, setPendingSkip] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["uninvoiced-appointments"],
    queryFn: () => fetchList(),
    staleTime: 30_000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["uninvoiced-appointments"] });
    void queryClient.invalidateQueries({ queryKey: ["cabinet-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["therapist-invoices"] });
  };

  const createMut = useMutation({
    mutationFn: (vars: { appointment_id: string; prix_unitaire: number; tva_taux: number }) =>
      createInvoice({ data: vars }),
    onSuccess: (res) => {
      refresh();
      toast.success("Brouillon de facture créé");
      void navigate({ to: "/dashboard/facturation", search: { invoice: res.id } as never });
    },
    onError: (e: Error) => toast.error(e.message || "Création impossible"),
  });

  const skipMut = useMutation({
    mutationFn: (id: string) => dismiss({ data: { appointment_id: id } }),
    onSuccess: () => {
      refresh();
      setPendingSkip(null);
      toast.success("Rendez-vous écarté de la facturation");
    },
    onError: (e: Error) => toast.error(e.message || "Action impossible"),
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  const rows = data ?? [];

  return (
    <>
      <Card className="bg-surface border-border/60">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-primary" aria-hidden="true" />
            Factures manquantes
            {rows.length > 0 && <Badge variant="secondary">{rows.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              Tous vos rendez-vous honorés sont facturés.
            </p>
          )}

          {rows.map((a) => {
            const priceValue = prices[a.id] ?? (a.suggested_price ? String(a.suggested_price) : "");
            const parsed = Number(priceValue.replace(",", "."));
            const valid = Number.isFinite(parsed) && parsed > 0;
            const busy = createMut.isPending && createMut.variables?.appointment_id === a.id;
            return (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-lg border border-border/60 bg-background/40 p-3 sm:flex-row sm:items-end"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground truncate">{a.client_name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.date ?? "—"}{a.time ? ` · ${a.time}` : ""} · {a.service ?? "Séance"}
                    {a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                    {a.suggested_vat > 0 ? ` · TVA ${a.suggested_vat}%` : " · sans TVA"}
                  </div>
                </div>

                <div className="w-full sm:w-32">
                  <Label htmlFor={`price-${a.id}`} className="text-xs">Montant (HT)</Label>
                  <Input
                    id={`price-${a.id}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.05"
                    value={priceValue}
                    onChange={(e) => setPrices((p) => ({ ...p, [a.id]: e.target.value }))}
                    aria-invalid={!valid}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="min-h-11"
                    disabled={!valid || busy}
                    onClick={() =>
                      createMut.mutate({
                        appointment_id: a.id,
                        prix_unitaire: parsed,
                        tva_taux: a.suggested_vat,
                      })
                    }
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Facturer"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
                    onClick={() => setPendingSkip(a.id)}
                    aria-label={`Écarter le rendez-vous de ${a.client_name} de la facturation`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}

          {rows.length > 0 && !rows.some((r) => r.suggested_price > 0) && (
            <p className="text-xs text-muted-foreground">
              Renseignez un tarif dans votre profil pour pré-remplir automatiquement les montants.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={pendingSkip !== null} onOpenChange={(o) => !o && setPendingSkip(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Écarter ce rendez-vous&nbsp;?</AlertDialogTitle>
            <AlertDialogDescription>
              Il ne réapparaîtra plus dans « Factures manquantes » et aucune facture ne sera créée.
              Utile pour une séance offerte ou réglée hors de l'application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingSkip && skipMut.mutate(pendingSkip)}
              disabled={skipMut.isPending}
            >
              Écarter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
