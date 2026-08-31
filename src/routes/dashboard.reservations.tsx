import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Check, X, Mail, CheckCheck, Search, CalendarDays, Users } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { listMyReservations, updateMyAppointmentStatus } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/dashboard/reservations")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Réservations du cabinet — HoliSwiss" },
      { name: "description", content: "Confirmez et suivez les demandes de rendez-vous de votre cabinet HoliSwiss." },
      { property: "og:title", content: "Réservations du cabinet — HoliSwiss" },
      { property: "og:description", content: "Confirmez et suivez les demandes de rendez-vous de votre cabinet HoliSwiss." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type Status = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
type Row = {
  id: string; patient_name: string; patient_email: string; patient_phone: string | null;
  appointment_date: string; appointment_time: string; status: Status; notes: string | null;
  service_name: string | null; duration_minutes: number | null; client_id: string | null;
};

const LABEL: Record<Status, string> = { pending: "En attente", confirmed: "Confirmée", cancelled: "Annulée", completed: "Terminée", no_show: "Absente" };
const CLASSES: Record<Status, string> = {
  pending: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  confirmed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  cancelled: "bg-red-500/15 text-red-300 border-red-500/30",
  completed: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  no_show: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

function formatWhen(date: string, time: string) {
  const d = new Date(`${date}T${(time || "00:00:00").slice(0, 8)}`);
  return `${d.toLocaleDateString("fr-CH", { weekday: "short", day: "numeric", month: "short" })} · ${time.slice(0, 5)}`;
}

function Page() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fetchReservations = useServerFn(listMyReservations);
  const updateStatus = useServerFn(updateMyAppointmentStatus);
  const [rows, setRows] = useState<Row[]>([]);
  const [tab, setTab] = useState<Status | "all">("all");
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{ id: string; action: "confirmed" | "cancelled" | "completed" | "no_show" } | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { rows: data } = await fetchReservations();
      if (cancelled) return;
      setRows((data ?? []) as Row[]);
      setLoading(false);
    };
    void load();
    const id = window.setInterval(load, 30000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [fetchReservations, user]);

  const counts = useMemo(() => ({
    all: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    confirmed: rows.filter((r) => r.status === "confirmed").length,
    completed: rows.filter((r) => r.status === "completed").length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    no_show: rows.filter((r) => r.status === "no_show").length,
  }), [rows]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (tab === "all" ? true : r.status === tab))
      .filter((r) => !q || [r.patient_name, r.patient_email, r.patient_phone, r.service_name]
        .some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [rows, tab, search]);

  const apply = async () => {
    if (!pending) return;
    try {
      const result = await updateStatus({ data: {
        id: pending.id,
        status: pending.action,
        reason: pending.action === "cancelled" ? cancellationReason : null,
      } });
      const { rows: fresh } = await fetchReservations();
      setRows((fresh ?? []) as Row[]);
      // La confirmation change ce que l'agenda et la fiche client doivent
      // montrer : on invalide leurs caches ici, sinon le praticien doit
      // recharger la page pour voir apparaître son rendez-vous.
      queryClient.invalidateQueries({ queryKey: ["interactive-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["cabinet-clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-detail"] });
      queryClient.invalidateQueries({ queryKey: ["billing-queue"] });
      if (pending.action === "completed") {
        toast.success(
          (result as { reviewRequestSent?: boolean } | null)?.reviewRequestSent
            ? "Séance terminée — demande d'avis envoyée au patient"
            : "Séance terminée",
        );
      } else {
        toast.success(
          pending.action === "confirmed"
            ? "Réservation confirmée — visible dans votre agenda"
            : "Réservation annulée",
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur de mise à jour");
    }
    setPending(null);
    setCancellationReason("");
  };

  if (loading) return <div className="p-10 text-muted-foreground">Chargement…</div>;

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Réservations</h1>
          <p className="text-muted-foreground mt-1">Acceptez, refusez ou contactez vos visiteurs.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/agenda"><CalendarDays className="h-4 w-4 mr-2" /> Voir l'agenda</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Status | "all")}>
          <TabsList className="bg-surface border border-border/60">
            <TabsTrigger value="all">Toutes ({counts.all})</TabsTrigger>
            <TabsTrigger value="pending">En attente ({counts.pending})</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmées ({counts.confirmed})</TabsTrigger>
            <TabsTrigger value="completed">Terminées ({counts.completed})</TabsTrigger>
            <TabsTrigger value="cancelled">Annulées ({counts.cancelled})</TabsTrigger>
            <TabsTrigger value="no_show">Absentes ({counts.no_show})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative min-w-[240px] flex-1 max-w-sm">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            className="pl-9"
            placeholder="Rechercher un nom, e-mail, téléphone…"
            aria-label="Rechercher une réservation"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Desktop */}
      <Card className="bg-surface border-border/60 hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visiteur</TableHead>
                <TableHead>Date &amp; heure</TableHead>
                <TableHead>Prestation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{b.patient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.patient_email}{b.patient_phone ? ` · ${b.patient_phone}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatWhen(b.appointment_date, b.appointment_time)}
                    <div className="text-xs text-muted-foreground">{b.duration_minutes ?? 60} min</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{b.service_name ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className={CLASSES[b.status]}>{LABEL[b.status]}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Actions row={b} onAction={(action) => setPending({ id: b.id, action })} />
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10">Aucune réservation</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {list.map((b) => (
          <Card key={b.id} className="bg-surface border-border/60">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{b.patient_name}</div>
                  <div className="text-xs text-muted-foreground">{b.patient_email}</div>
                </div>
                <Badge variant="outline" className={CLASSES[b.status]}>{LABEL[b.status]}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {formatWhen(b.appointment_date, b.appointment_time)} · {b.duration_minutes ?? 60} min
                {b.service_name ? ` · ${b.service_name}` : ""}
              </div>
              <div className="flex justify-end gap-1 pt-1">
                <Actions row={b} onAction={(action) => setPending({ id: b.id, action })} />
              </div>
            </CardContent>
          </Card>
        ))}
        {list.length === 0 && <p className="text-center text-muted-foreground py-10">Aucune réservation</p>}
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === "confirmed" ? "Confirmer la réservation ?"
                : pending?.action === "completed" ? "Marquer la séance comme terminée ?"
                : pending?.action === "no_show" ? "Marquer le patient comme absent ?"
                : "Annuler la réservation ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "confirmed"
                ? "Le patient sera notifié et le rendez-vous apparaîtra dans votre agenda."
                : pending?.action === "completed"
                ? "Une demande d'avis sera envoyée au patient, et la séance deviendra facturable."
                : pending?.action === "no_show"
                ? "L’absence sera conservée dans l’historique et le rendez-vous ne sera pas facturable."
                : "Cette action notifiera le patient. Le rendez-vous reste dans l'historique mais n'occupe plus de créneau actif."}
            </AlertDialogDescription>
            {pending?.action === "cancelled" && (
              <div className="space-y-2">
                <label htmlFor="reservation-cancellation-reason" className="text-sm font-medium">Motif d’annulation</label>
                <Input
                  id="reservation-cancellation-reason"
                  value={cancellationReason}
                  onChange={(event) => setCancellationReason(event.target.value)}
                  placeholder="Indiquez le motif conservé dans l’historique"
                />
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction disabled={pending?.action === "cancelled" && cancellationReason.trim().length < 2} onClick={apply}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Actions({ row, onAction }: { row: Row; onAction: (a: "confirmed" | "cancelled" | "completed" | "no_show") => void }) {
  return (
    <>
      {row.status === "pending" && (
        <>
          <Button aria-label="Confirmer" title="Confirmer" size="sm" onClick={() => onAction("confirmed")}
            className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"><Check className="h-4 w-4" /></Button>
          <Button aria-label="Annuler" title="Annuler" size="sm" variant="ghost" onClick={() => onAction("cancelled")}>
            <X className="h-4 w-4" />
          </Button>
          <Button aria-label="Marquer absente" title="Marquer absente" size="sm" variant="ghost" onClick={() => onAction("no_show")}>Abs.</Button>
        </>
      )}
      {row.status === "confirmed" && (
        <>
          <Button aria-label="Marquer terminée" title="Marquer terminée" size="sm" onClick={() => onAction("completed")}
            className="bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"><CheckCheck className="h-4 w-4" /></Button>
          <Button aria-label="Annuler" title="Annuler" size="sm" variant="ghost" onClick={() => onAction("cancelled")}>
            <X className="h-4 w-4" />
          </Button>
        </>
      )}
      {row.client_id && (
        <Button aria-label="Ouvrir la fiche client" title="Fiche client" asChild size="sm" variant="ghost">
          <Link to="/dashboard/clients" search={{ client: row.client_id ?? undefined }}><Users className="h-4 w-4" /></Link>
        </Button>
      )}
      <Button aria-label="Contacter par e-mail" title="Contacter" asChild size="sm" variant="ghost">
        <a href={`mailto:${row.patient_email}`}><Mail className="h-4 w-4" /></a>
      </Button>
    </>
  );
}
