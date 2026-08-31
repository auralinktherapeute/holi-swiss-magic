import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search, Users, ShieldCheck, ShieldAlert, Receipt, Calendar,
  Phone, Mail, X, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCabinetClient, listCabinetClients, updateClientConsent,
} from "@/lib/cabinet.functions";
import { upsertTask } from "@/lib/crm-therapist.functions";
import ClientDocuments from "@/components/dashboard/ClientDocuments";
import { QuickInvoiceDialog, type QuickInvoiceTarget } from "@/components/dashboard/QuickInvoiceDialog";


export const Route = createFileRoute("/dashboard/clients")({
  component: ClientsPage,
  validateSearch: z.object({ client: z.string().uuid().optional() }),
  head: () => ({
    meta: [
      { title: "Clients du cabinet — HoliSwiss" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect",
  new: "Nouveau",
  active: "Actif",
  followup: "À relancer",
  inactive: "Inactif",
};

function money(n: number, currency = "CHF") {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency }).format(n);
}

function shortDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
}

function ClientsPage() {
  const { client: requestedClient } = Route.useSearch();
  const listFn = useServerFn(listCabinetClients);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(requestedClient ?? null);

  useEffect(() => {
    setOpenId(requestedClient ?? null);
  }, [requestedClient]);

  // Debounce de la recherche pour éviter une requête par frappe.
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(id);
  }, [search]);


  const { data, isLoading, isError } = useQuery({
    queryKey: ["cabinet-clients", debounced, status, unpaidOnly],
    queryFn: () =>
      listFn({
        data: {
          search: debounced || undefined,
          status: status === "all" ? undefined : status,
          unpaidOnly,
        },
      }),
    staleTime: 15_000,
  });

  const rows = data ?? [];

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vos clients, leur historique de rendez-vous, leurs factures et leur consentement.
          </p>
        </div>
      </header>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <Label htmlFor="client-search" className="text-xs">Recherche</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="client-search"
                className="pl-8 min-h-11"
                placeholder="Nom, e-mail, téléphone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="min-w-[160px]">
            <Label htmlFor="client-status" className="text-xs">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="client-status" className="mt-1 min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant={unpaidOnly ? "default" : "outline"}
            className="min-h-11"
            aria-pressed={unpaidOnly}
            onClick={() => setUnpaidOnly((v) => !v)}
          >
            <Receipt className="h-4 w-4 mr-2" aria-hidden="true" />
            Impayés uniquement
          </Button>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {isError && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Impossible de charger vos clients. Rechargez la page.
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && rows.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Users className="h-8 w-8 mx-auto text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Aucun client ne correspond à votre recherche.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && rows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{rows.length} client(s)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {rows.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(c.id)}
                    className="w-full text-left px-4 py-3 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex flex-wrap items-center gap-3"
                  >
                    <div className="flex-1 min-w-[180px]">
                      <div className="font-medium text-foreground">
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3">
                        {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" aria-hidden="true" />{c.email}</span>}
                        {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" aria-hidden="true" />{c.phone}</span>}
                      </div>
                    </div>
                    <Badge variant="secondary">{STATUS_LABEL[c.relation_status] ?? c.relation_status}</Badge>
                    <span className="text-xs text-muted-foreground w-24">
                      {c.appointments_count} RDV
                    </span>
                    <span className="text-xs text-muted-foreground w-32">
                      Dernier : {shortDate(c.last_booking_at)}
                    </span>
                    <span className={`text-sm font-semibold w-28 text-right ${c.balance_due > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {c.balance_due > 0 ? money(c.balance_due) : "—"}
                    </span>
                    {c.consent_at ? (
                      <ShieldCheck className="h-4 w-4 text-emerald-500" aria-label="Consentement enregistré" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-amber-500" aria-label="Consentement manquant" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {openId && <ClientDialog id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ClientDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const detailFn = useServerFn(getCabinetClient);
  const consentFn = useServerFn(updateClientConsent);
  const taskFn = useServerFn(upsertTask);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cabinet-client", id],
    queryFn: () => detailFn({ data: { id } }),
  });

  const consent = useMutation({
    mutationFn: (given: boolean) =>
      consentFn({ data: { id, consent_given: given, consent_source: "saisie thérapeute" } }),
    onSuccess: () => {
      toast.success("Consentement mis à jour.");
      qc.invalidateQueries({ queryKey: ["cabinet-client", id] });
      qc.invalidateQueries({ queryKey: ["cabinet-clients"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec de la mise à jour."),
  });

  const client: any = data?.client;
  const [wizard, setWizard] = useState<QuickInvoiceTarget | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const taskMut = useMutation({
    mutationFn: (vars: { id?: string; title: string; due_at?: string | null; done?: boolean }) =>
      taskFn({ data: { contact_id: id, priority: "normal", ...vars } as any }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cabinet-client", id] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      setTaskTitle("");
      setTaskDue("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Échec de l'enregistrement de la tâche."),
  });

  const dd: any = data ?? {};
  const fullName = `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim();

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isLoading ? "Chargement…" : fullName || "Client"}</DialogTitle>
        </DialogHeader>

        {isLoading && <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}

        {!isLoading && data && (
          <Tabs defaultValue="apercu">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="apercu">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="rdv">Rendez-vous</TabsTrigger>
              <TabsTrigger value="factures">Factures</TabsTrigger>
              <TabsTrigger value="paiements">Paiements</TabsTrigger>
              <TabsTrigger value="taches">Tâches</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="apercu" className="mt-4 space-y-4">
              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Contact</div>
                  <div className="text-sm mt-1">{client.email ?? "—"}</div>
                  <div className="text-sm">{client.phone ?? "—"}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Solde dû</div>
                  <div className={`text-lg font-semibold ${data.balance_due > 0 ? "text-destructive" : ""}`}>
                    {money(data.balance_due)}
                  </div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Rendez-vous</div>
                  <div className="text-lg font-semibold">{dd.appointments?.length ?? 0}</div>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="text-xs text-muted-foreground">Factures</div>
                  <div className="text-lg font-semibold">{dd.invoices?.length ?? 0}</div>
                </div>
              </section>

              <section className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Consentement (RGPD / nLPD)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {client.consent_at
                        ? `Recueilli le ${shortDate(client.consent_at)} — ${client.consent_source ?? "source non précisée"}`
                        : "Aucun consentement enregistré pour ce client."}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={client.consent_at ? "outline" : "default"}
                    disabled={consent.isPending}
                    onClick={() => consent.mutate(!client.consent_at)}
                  >
                    {client.consent_at ? "Retirer" : "Enregistrer"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Base légale : {client.legal_basis === "consent" ? "consentement" : "exécution du contrat de soins"}.
                </p>
              </section>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/dashboard/facturation" search={{ vue: "a_facturer" }}>
                    Facturer une séance <ExternalLink className="h-3.5 w-3.5 ml-1.5" aria-hidden="true" />
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4 mr-1.5" aria-hidden="true" /> Fermer
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="rdv" className="mt-4">
              <Section title="Rendez-vous" icon={Calendar} empty="Aucun rendez-vous enregistré.">
                {(dd.appointments ?? []).map((a: any) => {
                  const billable =
                    !a.invoiced_at && (a.status === "completed" || a.status === "confirmed");
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                      <span>{shortDate(a.appointment_date)} {a.appointment_time ? String(a.appointment_time).slice(0, 5) : ""}</span>
                      <span className="text-muted-foreground truncate">{a.service_name ?? "Séance"}</span>
                      <Badge variant={a.status === "confirmed" ? "default" : "secondary"}>{a.status}</Badge>
                      {a.invoiced_at ? (
                        <span className="text-xs text-emerald-500">facturé</span>
                      ) : (
                        <span className="text-xs text-amber-500">non facturé</span>
                      )}
                      {billable && (
                        <Button
                          size="sm"
                          className="min-h-9"
                          onClick={() =>
                            setWizard({
                              id: a.id,
                              client_name: fullName || (a.patient_name ?? "Client"),
                              date: a.appointment_date ?? null,
                              time: a.appointment_time ? String(a.appointment_time).slice(0, 5) : null,
                              service: a.service_name ?? null,
                              duration_minutes: Number(a.duration_minutes ?? 0),
                              suggested_price: 0,
                              suggested_vat: 0,
                            })
                          }
                        >
                          Facturer…
                        </Button>
                      )}
                    </li>
                  );
                })}
              </Section>
            </TabsContent>

            <TabsContent value="factures" className="mt-4">
              <Section title="Factures" icon={Receipt} empty="Aucune facture pour ce client.">
                {(dd.invoices ?? []).map((i: any) => (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span>{i.numero_facture ?? "Brouillon"}</span>
                    <span className="text-muted-foreground">{shortDate(i.date_emission)}</span>
                    <span>{money(i.montant_total, i.currency ?? "CHF")}</span>
                    <span className={i.solde > 0 ? "text-destructive" : "text-muted-foreground"}>
                      Solde {money(i.solde, i.currency ?? "CHF")}
                    </span>
                    <Badge variant="secondary">{i.statut}</Badge>
                  </li>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="paiements" className="mt-4">
              <Section title="Encaissements" icon={Receipt} empty="Aucun encaissement enregistré.">
                {(dd.payments ?? []).map((p: any) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span>{shortDate(p.date_paiement)}</span>
                    <span className="text-muted-foreground">{p.numero_facture}</span>
                    <span className="text-muted-foreground">{p.mode_paiement ?? "—"}</span>
                    <span className={p.montant < 0 ? "text-destructive" : ""}>{money(p.montant)}</span>
                  </li>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="taches" className="mt-4 space-y-3">
              <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!taskTitle.trim()) return;
                  taskMut.mutate({ title: taskTitle.trim(), due_at: taskDue || null });
                }}
              >
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="task-title" className="text-xs">Nouvelle tâche</Label>
                  <Input id="task-title" className="mt-1 min-h-11" value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)} placeholder="Rappeler pour un suivi…" />
                </div>
                <div>
                  <Label htmlFor="task-due" className="text-xs">Échéance</Label>
                  <Input id="task-due" type="date" className="mt-1 min-h-11" value={taskDue}
                    onChange={(e) => setTaskDue(e.target.value)} />
                </div>
                <Button type="submit" className="min-h-11" disabled={!taskTitle.trim() || taskMut.isPending}>
                  Ajouter
                </Button>
              </form>

              <Section title="Tâches liées" icon={Calendar} empty="Aucune tâche pour ce client.">
                {(dd.tasks ?? []).map((t: any) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span className={t.done ? "line-through text-muted-foreground" : ""}>{t.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.due_at ? `Échéance ${shortDate(t.due_at)}` : "Sans échéance"}
                    </span>
                    <Button size="sm" variant={t.done ? "outline" : "default"} className="min-h-9"
                      disabled={taskMut.isPending}
                      onClick={() => taskMut.mutate({ id: t.id, title: t.title, done: !t.done })}>
                      {t.done ? "Rouvrir" : "Terminer"}
                    </Button>
                  </li>
                ))}
              </Section>
            </TabsContent>

            <TabsContent value="notes" className="mt-4">
              <Section title="Notes de séance" icon={Calendar} empty="Aucune note enregistrée.">
                {(dd.notes ?? []).map((n: any) => (
                  <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span>{n.title || "Note de séance"}</span>
                    <span className="text-xs text-muted-foreground">{shortDate(n.session_date)}</span>
                  </li>
                ))}
              </Section>
              <p className="text-xs text-muted-foreground mt-2">
                Le contenu détaillé des notes reste consultable dans Suivi &amp; tâches.
              </p>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <ClientDocuments clientId={id} />
            </TabsContent>
          </Tabs>
        )}

        {!isLoading && data && (
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Secret professionnel : ces informations sont confidentielles. Chaque consultation de
            fiche est journalisée.
          </p>
        )}

        <QuickInvoiceDialog
          appointment={wizard}
          open={!!wizard}
          onOpenChange={(o) => { if (!o) setWizard(null); }}
        />
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title, icon: Icon, empty, children,
}: {
  title: string;
  icon: any;
  empty: string;
  children: ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.flat().filter(Boolean).length === 0;
  return (
    <section className="rounded-lg border border-border p-3">
      <h3 className="text-sm font-medium flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4" aria-hidden="true" /> {title}
      </h3>
      {isEmpty ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </section>
  );
}

