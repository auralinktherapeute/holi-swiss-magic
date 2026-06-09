import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, Pause, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/therapeutes")({ component: Page });

type Status = "pending" | "approved" | "rejected" | "suspended";
type Row = { id: string; name: string; email: string; canton: string; plan: string; status: Status; created: string };

const ROWS: Row[] = [
  { id: "1", name: "Claire Dupont", email: "claire@ex.ch", canton: "VD", plan: "Pro", status: "pending", created: "il y a 2 j" },
  { id: "2", name: "Marc Reber", email: "marc@ex.ch", canton: "ZH", plan: "Free", status: "approved", created: "il y a 1 mois" },
  { id: "3", name: "Anna Bianchi", email: "anna@ex.ch", canton: "TI", plan: "Premium", status: "approved", created: "il y a 3 mois" },
  { id: "4", name: "Lukas Meier", email: "lukas@ex.ch", canton: "BE", plan: "Pro", status: "pending", created: "il y a 1 j" },
  { id: "5", name: "Sofia Rossi", email: "sofia@ex.ch", canton: "GE", plan: "Pro", status: "suspended", created: "il y a 6 mois" },
  { id: "6", name: "Test fake", email: "spam@ex.ch", canton: "VS", plan: "Free", status: "rejected", created: "il y a 1 sem" },
];

const CLS: Record<Status, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  approved: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  suspended: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};
const LBL: Record<Status, string> = { pending: "En attente", approved: "Validé", rejected: "Rejeté", suspended: "Suspendu" };

function Page() {
  const [tab, setTab] = useState<Status | "all">("all");
  const [q, setQ] = useState("");
  const list = ROWS.filter((r) => (tab === "all" || r.status === tab) && (q === "" || r.name.toLowerCase().includes(q.toLowerCase()) || r.email.toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thérapeutes</h1>
        <p className="text-muted-foreground mt-1">Validez, rejetez ou suspendez les comptes</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status | "all")}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="pending">En attente</TabsTrigger>
            <TabsTrigger value="approved">Validés</TabsTrigger>
            <TabsTrigger value="suspended">Suspendus</TabsTrigger>
            <TabsTrigger value="rejected">Rejetés</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher nom ou email…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Thérapeute</TableHead><TableHead>Canton</TableHead><TableHead>Plan</TableHead>
            <TableHead>Statut</TableHead><TableHead>Inscrit</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.email}</div></TableCell>
                <TableCell>{r.canton}</TableCell>
                <TableCell><Badge variant="secondary">{r.plan}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={CLS[r.status]}>{LBL[r.status]}</Badge></TableCell>
                <TableCell className="text-muted-foreground">{r.created}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => window.open(`/fr/therapeute/${r.id}`, "_blank")}><ExternalLink className="h-3.5 w-3.5" /></Button>
                  {r.status === "pending" && <>
                    <Button size="sm" onClick={() => toast.success(`${r.name} validé`)} className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"><Check className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => toast(`${r.name} rejeté`)}><X className="h-3.5 w-3.5" /></Button>
                  </>}
                  {r.status === "approved" && <Button size="sm" variant="ghost" onClick={() => toast(`${r.name} suspendu`)}><Pause className="h-3.5 w-3.5" /></Button>}
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun résultat</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
