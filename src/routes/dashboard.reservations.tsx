import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/reservations")({ component: Page });

type Status = "pending" | "confirmed" | "cancelled";
type Booking = { id: string; patient: string; email: string; when: string; status: Status };

const ALL: Booking[] = [
  { id: "1", patient: "Marie L.", email: "marie@example.com", when: "Aujourd'hui · 14:00", status: "pending" },
  { id: "2", patient: "Jean P.", email: "jean@example.com", when: "Demain · 09:30", status: "confirmed" },
  { id: "3", patient: "Sophie K.", email: "sophie@example.com", when: "Jeu. 12 juin · 16:00", status: "confirmed" },
  { id: "4", patient: "Pierre M.", email: "pierre@example.com", when: "Lun. 9 juin · 11:00", status: "cancelled" },
];

const STATUS_LABEL: Record<Status, string> = { pending: "En attente", confirmed: "Confirmée", cancelled: "Annulée" };
const STATUS_CLASS: Record<Status, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
};

function Page() {
  const [tab, setTab] = useState<Status | "all">("all");
  const list = tab === "all" ? ALL : ALL.filter((b) => b.status === tab);

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Réservations</h1>
        <p className="text-muted-foreground mt-1">Acceptez, refusez ou contactez vos visiteurs</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status | "all")}>
        <TabsList className="bg-surface border border-border/60">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="pending">En attente</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmées</TabsTrigger>
          <TabsTrigger value="cancelled">Annulées</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="bg-surface border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visiteur</TableHead>
                <TableHead>Date & heure</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{b.patient}</div>
                    <div className="text-xs text-muted-foreground">{b.email}</div>
                  </TableCell>
                  <TableCell>{b.when}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status]}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    {b.status === "pending" && (
                      <>
                        <Button size="sm" onClick={() => toast.success("Réservation confirmée")} className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"><Check className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => toast("Réservation refusée")}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost"><Mail className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune réservation</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
