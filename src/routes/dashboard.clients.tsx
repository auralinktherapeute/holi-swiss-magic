import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Search, Users, ShieldCheck, ShieldAlert, Receipt, Calendar, FileText,
  Phone, Mail, X, ExternalLink, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getCabinetClient, listCabinetClients, updateClientConsent,
} from "@/lib/cabinet.functions";

export const Route = createFileRoute("/dashboard/clients")({
  component: ClientsPage,
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
  const listFn = useServerFn(listCabinetClients);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

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
        <Button asChild>
          <Link to="/dashboard/crm">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Nouveau client
          </Link>
        </Button>
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
            <Button asChild variant="outline">
              <Link to="/dashboard/crm">Ajouter un client</Link>
            </Button>
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

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isLoading ? "Chargement…" : `${client?.first_name ?? ""} ${client?.last_name ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}

        {!isLoading && data && (
          <div className="space-y-5">
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

            <Section title="Rendez-vous" icon={Calendar} empty="Aucun rendez-vous enregistré.">
              {data.appointments.slice(0, 8).map((a: any) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span>{shortDate(a.appointment_date)} {a.appointment_time ? String(a.appointment_time).slice(0, 5) : ""}</span>
                  <span className="text-muted-foreground truncate">{a.service_name ?? "Séance"}</span>
                  <Badge variant={a.status === "confirmed" ? "default" : "secondary"}>{a.status}</Badge>
                  {a.invoiced_at ? (
                    <span className="text-xs text-emerald-500">facturé</span>
                  ) : (
                    <span className="text-xs text-amber-500">non facturé</span>
                  )}
                </li>
              ))}
            </Section>

            <Section title="Factures" icon={Receipt} empty="Aucune facture pour ce client.">
              {data.invoices.slice(0, 8).map((i: any) => (
                <li key={i.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span>{i.numero_facture ?? "Brouillon"}</span>
                  <span className="text-muted-foreground">{shortDate(i.date_emission)}</span>
                  <span>{money(i.montant_total, i.currency ?? "CHF")}</span>
                  <Badge variant="secondary">{i.statut}</Badge>
                </li>
              ))}
            </Section>

            <Section title="Documents" icon={FileText} empty="Aucun document rattaché.">
              {data.documents.slice(0, 8).map((d: any) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <span className="truncate">{d.label || d.file_name}</span>
                  <Badge variant="secondary">{d.doc_type}</Badge>
                  {d.is_health_data && <span className="text-xs text-amber-500">donnée de santé</span>}
                </li>
              ))}
            </Section>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/crm">
                  Notes de séance <ExternalLink className="h-3.5 w-3.5 ml-1.5" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/facturation">
                  Créer une facture <ExternalLink className="h-3.5 w-3.5 ml-1.5" aria-hidden="true" />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4 mr-1.5" aria-hidden="true" /> Fermer
              </Button>
            </div>

            <p className="text-xs text-muted-foreground border-t border-border pt-3">
              Secret professionnel : ces informations sont confidentielles. Chaque consultation de
              fiche est journalisée.
            </p>
          </div>
        )}
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
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const isEmpty = items.filter(Boolean).length === 0;
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
