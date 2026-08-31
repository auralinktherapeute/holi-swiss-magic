// Onglet « Rendez-vous à facturer » : sélection multiple d'un même client,
// création d'une facture groupée et exclusion motivée.

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Ban, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  listAppointmentsToBill, excludeAppointmentFromBilling, createInvoiceFromAppointments,
  type AppointmentToBill,
} from "@/lib/billing-queue.functions";

function money(n: number) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(n);
}
function shortDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AppointmentsToBill({ onInvoiceCreated }: { onInvoiceCreated?: (id: string) => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAppointmentsToBill);
  const excludeFn = useServerFn(excludeAppointmentFromBilling);
  const createFn = useServerFn(createInvoiceFromAppointments);

  const [selected, setSelected] = useState<string[]>([]);
  const [excluding, setExcluding] = useState<AppointmentToBill | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["appointments-to-bill"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });
  const rows = useMemo(() => data ?? [], [data]);

  const selectedClient = useMemo(() => {
    const picked = rows.filter((r) => selected.includes(r.id));
    const ids = [...new Set(picked.map((r) => r.client_id))];
    return ids.length === 1 ? ids[0] : null;
  }, [rows, selected]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["appointments-to-bill"] });
    qc.invalidateQueries({ queryKey: ["clients-to-bill"] });
    qc.invalidateQueries({ queryKey: ["therapist-invoices"] });
    qc.invalidateQueries({ queryKey: ["cabinet-clients"] });
  };

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { appointment_ids: selected } }),
    onSuccess: (res: { id: string }) => {
      toast.success("Brouillon de facture créé à partir des rendez-vous sélectionnés.");
      setSelected([]);
      invalidate();
      onInvoiceCreated?.(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excludeMut = useMutation({
    mutationFn: () =>
      excludeFn({ data: { appointment_id: excluding!.id, reason: reason.trim() } }),
    onSuccess: () => {
      toast.success("Rendez-vous exclu de la facturation.");
      setExcluding(null);
      setReason("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (row: AppointmentToBill) => {
    setSelected((prev) => {
      if (prev.includes(row.id)) return prev.filter((x) => x !== row.id);
      const others = rows.filter((r) => prev.includes(r.id));
      if (others.length && others.some((o) => o.client_id !== row.client_id)) {
        toast.error("Regroupement impossible : sélectionnez des rendez-vous d'un même client.");
        return prev;
      }
      return [...prev, row.id];
    });
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  if (!rows.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <CalendarClock className="h-8 w-8 mx-auto mb-3 opacity-50" aria-hidden="true" />
          Aucun rendez-vous effectué en attente de facturation.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} rendez-vous effectué{rows.length > 1 ? "s" : ""} à facturer
          {selected.length > 0 && ` — ${selected.length} sélectionné${selected.length > 1 ? "s" : ""}`}
        </p>
        <Button
          disabled={!selected.length || !selectedClient || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          <Receipt className="h-4 w-4 mr-2" aria-hidden="true" />
          Créer une facture
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="p-3 w-10"><span className="sr-only">Sélection</span></th>
                <th className="p-3 text-left">Date</th>
                <th className="p-3 text-left">Client</th>
                <th className="p-3 text-left hidden md:table-cell">Prestation</th>
                <th className="p-3 text-left hidden sm:table-cell">Durée</th>
                <th className="p-3 text-right">Prix prévu</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="p-3">
                    <Checkbox
                      checked={selected.includes(r.id)}
                      onCheckedChange={() => toggle(r)}
                      aria-label={`Sélectionner le rendez-vous du ${shortDate(r.appointment_date)}`}
                    />
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {shortDate(r.appointment_date)}
                    {r.appointment_time && <span className="text-muted-foreground"> · {r.appointment_time.slice(0, 5)}</span>}
                  </td>
                  <td className="p-3 font-medium">{r.client_name}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{r.service_name ?? "—"}</td>
                  <td className="p-3 hidden sm:table-cell text-muted-foreground">
                    {r.duration_minutes ? `${r.duration_minutes} min` : "—"}
                  </td>
                  <td className="p-3 text-right">{r.expected_price != null ? money(r.expected_price) : "—"}</td>
                  <td className="p-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setExcluding(r); setReason(""); }}
                      aria-label="Exclure ce rendez-vous de la facturation"
                    >
                      <Ban className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!excluding} onOpenChange={(o) => !o && setExcluding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exclure de la facturation</DialogTitle>
            <DialogDescription>
              Le motif est obligatoire et conservé dans l'historique.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="exclusion-reason">Motif</Label>
            <Input
              id="exclusion-reason"
              className="mt-1 min-h-11"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Séance offerte, erreur d'agenda…"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluding(null)}>Annuler</Button>
            <Button
              disabled={reason.trim().length < 3 || excludeMut.isPending}
              onClick={() => excludeMut.mutate()}
            >
              Exclure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
