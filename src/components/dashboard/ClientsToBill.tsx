// Onglet « Clients à facturer » : volume non facturé et solde ouvert par client.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listClientsToBill, type ClientToBill } from "@/lib/billing-queue.functions";

function money(n: number) {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(n);
}

export default function ClientsToBill({ onSelect }: { onSelect?: (c: ClientToBill) => void }) {
  const listFn = useServerFn(listClientsToBill);
  const { data, isLoading } = useQuery({
    queryKey: ["clients-to-bill"],
    queryFn: () => listFn(),
    staleTime: 15_000,
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const rows = data ?? [];

  if (!rows.length) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-3 opacity-50" aria-hidden="true" />
          Aucun client en attente de facturation.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((c) => (
        <Card key={c.client_id}>
          <CardContent className="p-4 space-y-3">
            <div>
              <p className="font-medium">{c.client_name}</p>
              {c.email && <p className="text-xs text-muted-foreground truncate">{c.email}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                {c.appointments_count} séance{c.appointments_count > 1 ? "s" : ""} à facturer
              </Badge>
              {c.balance_due > 0 && (
                <Badge variant="destructive">Solde ouvert {money(c.balance_due)}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Montant estimé : <span className="text-foreground">{money(c.estimated_amount)}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full min-h-11"
              onClick={() => onSelect?.(c)}
            >
              Préparer la facture
              <ArrowRight className="h-4 w-4 ml-2" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
