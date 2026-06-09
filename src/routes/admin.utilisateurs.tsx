import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Ban, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { listUsersAdmin, setUserRole, deleteUserAdmin, banUserAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/utilisateurs")({ component: Page });

const ROLES = ["admin", "moderator", "therapist", "user"] as const;

function Page() {
  const fetchUsers = useServerFn(listUsersAdmin);
  const updateRole = useServerFn(setUserRole);
  const deleteUser = useServerFn(deleteUserAdmin);
  const banUser = useServerFn(banUserAdmin);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers({ data: { page: 1, perPage: 100 } }),
  });

  const [toDelete, setToDelete] = useState<{ id: string; email: string } | null>(null);

  const toggleRole = async (userId: string, role: string, enabled: boolean) => {
    try {
      await updateRole({ data: { userId, role: role as any, enabled } });
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  };

  const toggleBan = async (userId: string, isBanned: boolean) => {
    try {
      await banUser({ data: { userId, ban: !isBanned } });
      toast.success(isBanned ? "Compte réactivé" : "Compte suspendu");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteUser({ data: { userId: toDelete.id } });
      toast.success("Utilisateur supprimé");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) { toast.error(e.message ?? "Erreur"); }
    finally { setToDelete(null); }
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Utilisateurs</h1>
        <p className="text-muted-foreground mt-1">Gérez les comptes et leurs rôles</p>
      </div>

      <Card style={{ background: "#160d2b", border: "1px solid rgba(184,110,249,0.20)" }}>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Email</TableHead><TableHead>Rôles</TableHead>
              <TableHead>Créé le</TableHead><TableHead>Dernière connexion</TableHead>
              <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="inline h-4 w-4 animate-spin mr-2" />Chargement…
                </TableCell></TableRow>
              )}
              {!isLoading && (data?.users ?? []).map((u: any) => {
                const banned = u.banned_until && new Date(u.banned_until) > new Date();
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {ROLES.map((r) => {
                          const has = u.roles.includes(r);
                          return (
                            <button
                              key={r}
                              onClick={() => toggleRole(u.id, r, !has)}
                              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                                has
                                  ? "bg-primary/20 text-primary border-primary/40"
                                  : "bg-transparent text-muted-foreground border-white/10 hover:border-white/30"
                              }`}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(u.created_at).toLocaleDateString("fr-CH")}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-CH") : "—"}
                    </TableCell>
                    <TableCell>
                      {banned
                        ? <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30">Suspendu</Badge>
                        : <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">Actif</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => toggleBan(u.id, !!banned)}>
                        {banned ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete({ id: u.id, email: u.email })}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && (data?.users ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">Aucun utilisateur</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet utilisateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">{toDelete?.email}</span> sera supprimé définitivement. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-500/20 text-red-300 hover:bg-red-500/30">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
