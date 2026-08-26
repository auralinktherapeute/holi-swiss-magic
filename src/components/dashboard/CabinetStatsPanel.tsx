import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from "recharts";
import { BarChart3, Wand2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCabinetStats, syncCabinetAutoTasks } from "@/lib/cabinet.functions";

function money(n: number, currency = "CHF") {
  return new Intl.NumberFormat("fr-CH", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

/**
 * L6 — Statistiques du cabinet (12 mois) et génération des tâches de suivi.
 * Données agrégées uniquement : aucune note de séance ni donnée de santé.
 */
export function CabinetStatsPanel() {
  const fetchStats = useServerFn(getCabinetStats);
  const syncTasks = useServerFn(syncCabinetAutoTasks);
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["cabinet-stats", 12],
    queryFn: () => fetchStats({ data: { months: 12 } }),
    staleTime: 60_000,
  });

  const generate = useMutation({
    mutationFn: () => syncTasks(),
    onSuccess: (res: { created: number }) => {
      toast.success(
        res.created
          ? `${res.created} tâche(s) de suivi créée(s).`
          : "Aucune nouvelle tâche : tout est à jour.",
      );
      qc.invalidateQueries({ queryKey: ["cabinet-overview"] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: () => toast.error("Génération impossible. Réessayez."),
  });

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="p-4 text-sm text-destructive">
          Statistiques indisponibles pour le moment.
        </CardContent>
      </Card>
    );
  }

  const { totals, months, top_services, busiest_slots, currency } = data;

  const kpis = [
    { label: "Séances honorées", value: String(totals.honored), sub: "12 derniers mois" },
    { label: "Encaissé", value: money(totals.revenue, currency), sub: `panier moyen ${money(totals.avg_basket, currency)}` },
    { label: "Taux d'absence", value: `${totals.no_show_rate}%`, sub: `${totals.no_show} absence(s)` },
    { label: "Nouveaux clients", value: String(totals.new_clients), sub: "12 derniers mois" },
  ];

  return (
    <section className="space-y-6" aria-labelledby="cabinet-stats-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="cabinet-stats-title" className="flex items-center gap-2 text-lg font-semibold">
          <BarChart3 className="h-5 w-5 text-purple-400" aria-hidden="true" />
          Statistiques du cabinet
        </h2>
        <Button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="min-h-11"
        >
          {generate.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Wand2 className="h-4 w-4" aria-hidden="true" />
          )}
          Générer mes tâches de suivi
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Séances par mois</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="honored" name="Honorées" fill="#7c3aed" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cancelled" name="Annulées" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="no_show" name="Absences" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Encaissements par mois ({currency})</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={months} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.12} />
              <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v: number) => money(Number(v), currency)} contentStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name="Encaissé" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prestations les plus demandées</CardTitle>
          </CardHeader>
          <CardContent>
            {top_services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Pas encore de séance honorée.</p>
            ) : (
              <ul className="space-y-2">
                {top_services.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate">{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Créneaux les plus remplis</CardTitle>
          </CardHeader>
          <CardContent>
            {busiest_slots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée horaire disponible.</p>
            ) : (
              <ul className="space-y-2">
                {busiest_slots.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{s.name}</span>
                    <span className="tabular-nums text-muted-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
