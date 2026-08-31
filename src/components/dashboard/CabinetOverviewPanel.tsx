import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays, Users, Receipt, AlertTriangle, ArrowUpRight,
  Plus, FileText, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getCabinetOverview } from "@/lib/cabinet.functions";

function money(n: number, currency = "CHF") {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

/**
 * Vue d'ensemble du cabinet : KPI réels, agenda du jour, facturation rapide,
 * tâches prioritaires et alertes critiques. Toutes les données proviennent
 * d'une seule server function filtrée par therapist_id.
 */
export function CabinetOverviewPanel() {
  const fetchOverview = useServerFn(getCabinetOverview);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["cabinet-overview"],
    queryFn: () => fetchOverview(),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-4 text-sm text-destructive">
          Impossible de charger votre tableau de bord. Rechargez la page.
        </CardContent>
      </Card>
    );
  }

  const { kpi, today, invoices, alerts } = data;

  const cards = [
    { label: "RDV aujourd'hui", value: String(kpi.appointments_today), sub: `${kpi.appointments_week} cette semaine`, icon: CalendarDays, to: "/dashboard/agenda" as const },
    { label: "Factures en attente", value: String(kpi.invoices_pending), sub: "à suivre", icon: Receipt, to: "/dashboard/facturation" as const },
    { label: "Impayés", value: money(kpi.unpaid_amount, kpi.currency), sub: `${kpi.unpaid_count} facture(s)`, icon: AlertTriangle, to: "/dashboard/facturation" as const },
    { label: "Clients actifs", value: String(kpi.active_clients), sub: "30 derniers jours", icon: Users, to: "/dashboard/clients" as const },
  ];

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link
                to={a.to}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm min-h-11 ${
                  a.level === "critical"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                }`}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{a.message}</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="h-full bg-surface border-border/60 transition-colors hover:border-primary/40">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold text-foreground">{c.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm"><Link to="/dashboard/agenda"><Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />Nouveau RDV</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/dashboard/clients"><Users className="h-4 w-4 mr-1.5" aria-hidden="true" />Clients</Link></Button>
        <Button asChild size="sm" variant="outline"><Link to="/dashboard/facturation"><Receipt className="h-4 w-4 mr-1.5" aria-hidden="true" />Créer une facture</Link></Button>
        
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-surface border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Agenda du jour</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/agenda">Voir l'agenda <ArrowUpRight className="h-4 w-4 ml-1" aria-hidden="true" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {today.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucun rendez-vous aujourd'hui.
              </p>
            )}
            {today.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground w-16">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  {a.time ?? "—"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{a.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {a.service ?? "Séance"}{a.duration_minutes ? ` · ${a.duration_minutes} min` : ""}
                  </div>
                </div>
                <Badge variant={a.status === "confirmed" ? "default" : "secondary"}>{a.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-surface border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Facturation</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard/facturation"><FileText className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Ouvrir la facturation</span></Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {invoices.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune facture ouverte.</p>
              )}
              {invoices.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{i.numero_facture ?? "Brouillon"}</span>
                  <span className="text-muted-foreground truncate">{i.client_name ?? "—"}</span>
                  <span className="font-medium">{money(i.solde, i.currency)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
