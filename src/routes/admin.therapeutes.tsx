import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Pause, Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listTherapistsAdmin, updateTherapistStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/therapeutes")({ component: Page });

const STATUS_CLS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-300 border-red-500/30",
  suspended: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};
const STATUS_LBL: Record<string, string> = { pending: "En attente", active: "Validé", rejected: "Rejeté", suspended: "Suspendu" };
const CANTONS = ["all", "VD", "GE", "VS", "FR", "NE", "JU", "BE", "ZH", "BS", "BL", "AG", "SO", "LU", "ZG", "SG", "TI"];
const PAGE_SIZE = 20;

type Action = { id: string; name: string; type: "active" | "rejected" | "suspended" } | null;

function Page() {
  const [status, setStatus] = useState("all");
  const [canton, setCanton] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState("");

  const fetchList = useServerFn(listTherapistsAdmin);
  const updateStatus = useServerFn(updateTherapistStatus);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-therapists", status, canton, search, page],
    queryFn: () => fetchList({ data: { status, canton, search, page, pageSize: PAGE_SIZE } }),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  const confirmAction = async () => {
    if (!action) return;
    try {
      await updateStatus({ data: { id: action.id, status: action.type, reason: reason || undefined } });
      toast.success(`${action.name} : statut mis à jour`);
      qc.invalidateQueries({ queryKey: ["admin-therapists"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erreur");
    } finally {
      setAction(null);
      setReason("");
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Thérapeutes</h1>
        <p className="text-muted-foreground mt-1">Validez, rejetez ou suspendez les comptes</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <TabsList>
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="pending">En attente</TabsTrigger>
            <TabsTrigger value="active">Validés</TabsTrigger>
            <TabsTrigger value="suspended">Suspendus</TabsTrigger>
            <TabsTrigger value="rejected">Rejetés</TabsTrigger>
          </TabsList>
        </Tabs>
        <select
          value={canton}
          onChange={(e) => { setCanton(e.target.value); setPage(1); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {CANTONS.map((c) => <option key={c} value={c}>{c === "all" ? "Tous cantons" : c}</option>)}
        </select>
        <div className="relative flex-1 max-w-sm ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher nom ou email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
      </div>

      <Card style={{ background: "#160d2b", border: "1px solid rgba(184,110,249,0.20)" }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Thérapeute</TableHead><TableHead>Canton</TableHead>
              <TableHead>Statut</TableHead><TableHead>Inscrit</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />Chargement…
                </TableCell></TableRow>
              )}
              {!isLoading && (data?.rows ?? []).map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="font-medium">{r.first_name} {r.last_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email ?? "—"}</div>
                  </TableCell>
                  <TableCell>{r.canton ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_CLS[r.status] ?? ""}>{STATUS_LBL[r.status] ?? r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString("fr-CH")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => window.open(`/fr/therapeute/${r.slug}`, "_blank")}>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    {r.status !== "active" && (
                      <Button size="sm" onClick={() => setAction({ id: r.id, name: `${r.first_name} ${r.last_name}`, type: "active" })}
                        className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30">
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {r.status !== "rejected" && (
                      <Button size="sm" variant="ghost" onClick={() => setAction({ id: r.id, name: `${r.first_name} ${r.last_name}`, type: "rejected" })}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {r.status === "active" && (
                      <Button size="sm" variant="ghost" onClick={() => setAction({ id: r.id, name: `${r.first_name} ${r.last_name}`, type: "suspended" })}>
                        <Pause className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (data?.rows ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">Aucun résultat</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} thérapeute(s) · page {page}/{totalPages}</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
          <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
        </div>
      </div>

      <AlertDialog open={action !== null} onOpenChange={(o) => { if (!o) { setAction(null); setReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action?.type === "active" && "Valider ce thérapeute ?"}
              {action?.type === "rejected" && "Rejeter ce thérapeute ?"}
              {action?.type === "suspended" && "Suspendre ce thérapeute ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>{action?.name}</AlertDialogDescription>
          </AlertDialogHeader>
          {action?.type === "rejected" && (
            <Textarea
              placeholder="Raison du rejet (obligatoire)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={action?.type === "rejected" && reason.trim().length === 0}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
