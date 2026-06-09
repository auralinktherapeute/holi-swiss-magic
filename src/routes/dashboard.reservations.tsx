import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard/reservations")({ component: Page });

type Status = "pending" | "confirmed" | "cancelled" | "completed";
type Row = {
  id: string; patient_name: string; patient_email: string; patient_phone: string | null;
  appointment_date: string; appointment_time: string; status: Status; notes: string | null;
};

const LABEL: Record<Status, string> = { pending: "En attente", confirmed: "Confirmée", cancelled: "Annulée", completed: "Terminée" };
const CLASSES: Record<Status, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
  completed: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

function Page() {
  const { user } = useAuth();
  const [therapistId, setTherapistId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Status | "all">("all");
  const [pending, setPending] = useState<{ id: string; action: "confirmed" | "cancelled" } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: th } = await supabase.from("therapists").select("id").eq("user_id", user.id).maybeSingle();
      if (!th) { setLoading(false); return; }
      setTherapistId(th.id);
      const { data } = await supabase.from("appointments").select("*").eq("therapist_id", th.id)
        .order("appointment_date", { ascending: false }).order("appointment_time", { ascending: false });
      setRows((data ?? []) as Row[]);
      setLoading(false);
      channel = supabase.channel(`appts-${th.id}`).on("postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `therapist_id=eq.${th.id}` },
        () => {
          supabase.from("appointments").select("*").eq("therapist_id", th.id)
            .order("appointment_date", { ascending: false }).order("appointment_time", { ascending: false })
            .then(({ data }) => setRows((data ?? []) as Row[]));
        }).subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const list = tab === "all" ? rows : rows.filter((r) => r.status === tab);

  const apply = async () => {
    if (!pending) return;
    const { error } = await supabase.from("appointments").update({ status: pending.action }).eq("id", pending.id);
    if (error) toast.error(error.message);
    else toast.success(pending.action === "confirmed" ? "Réservation confirmée" : "Réservation annulée");
    setPending(null);
  };

  if (loading) return <div className="p-10 text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Réservations</h1>
        <p className="text-muted-foreground mt-1">Acceptez, refusez ou contactez vos visiteurs</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status | "all")}>
        <TabsList className="bg-surface border border-border/60">
          <TabsTrigger value="all">Toutes ({rows.length})</TabsTrigger>
          <TabsTrigger value="pending">En attente ({rows.filter(r => r.status === "pending").length})</TabsTrigger>
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
                    <div className="font-medium text-foreground">{b.patient_name}</div>
                    <div className="text-xs text-muted-foreground">{b.patient_email}{b.patient_phone ? ` · ${b.patient_phone}` : ""}</div>
                  </TableCell>
                  <TableCell>
                    {new Date(b.appointment_date).toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" })} · {b.appointment_time.slice(0, 5)}
                  </TableCell>
                  <TableCell><Badge variant="outline" className={CLASSES[b.status]}>{LABEL[b.status]}</Badge></TableCell>
                  <TableCell className="text-right space-x-2">
                    {b.status === "pending" && (
                      <>
                        <Button aria-label="Confirmer" size="sm" onClick={() => setPending({ id: b.id, action: "confirmed" })}
                          className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"><Check className="h-3.5 w-3.5" /></Button>
                        <Button aria-label="Annuler" size="sm" variant="ghost" onClick={() => setPending({ id: b.id, action: "cancelled" })}><X className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                    <Button aria-label="Contacter" asChild size="sm" variant="ghost">
                      <a href={`mailto:${b.patient_email}`}><Mail className="h-3.5 w-3.5" /></a>
                    </Button>
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

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.action === "confirmed" ? "Confirmer la réservation ?" : "Annuler la réservation ?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "confirmed"
                ? "Le patient sera notifié de la confirmation."
                : "Cette action notifiera le patient de l'annulation."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction onClick={apply}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
