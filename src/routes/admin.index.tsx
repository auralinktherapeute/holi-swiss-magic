import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, Clock, CalendarDays, TrendingUp, Sparkles } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { getAdminStats } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({ component: Page });

const SURFACE = { background: "#160d2b", border: "1px solid rgba(184,110,249,0.20)" };

function Page() {
  const fetchStats = useServerFn(getAdminStats);
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: () => fetchStats() });

  const stats = [
    { label: "Total thérapeutes", value: data?.totalTherapists ?? 0, icon: Users },
    { label: "Actifs", value: data?.activeTherapists ?? 0, icon: UserCheck },
    { label: "En attente", value: data?.pendingTherapists ?? 0, icon: Clock },
    { label: "Réservations (mois)", value: data?.appointmentsThisMonth ?? 0, icon: CalendarDays },
    { label: "Revenus abonnements", value: `${data?.revenueMrr ?? 0} CHF`, icon: TrendingUp },
    { label: "Nouveaux (7j)", value: data?.newSignups7d ?? 0, icon: Sparkles },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Vue d'ensemble</h1>
        <p className="text-muted-foreground mt-1">Tableau de bord Holiswiss</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} style={SURFACE}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className="h-4 w-4" style={{ color: "#b86ef9" }} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{isLoading ? "—" : s.value}</div>
                <div className="h-10 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data?.signupsSparkline ?? []}>
                      <Line type="monotone" dataKey="v" stroke="#b86ef9" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card style={SURFACE}>
          <CardHeader><CardTitle>5 dernières inscriptions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.lastTherapists ?? []).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <Link to="/$lang/therapeute/$slug" params={{ lang: "fr", slug: t.slug }} className="font-medium hover:underline">
                    {t.first_name} {t.last_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{t.canton ?? "—"} · {new Date(t.created_at).toLocaleDateString("fr-CH")}</div>
                </div>
                <Badge variant="outline">{t.status}</Badge>
              </div>
            ))}
            {!isLoading && (data?.lastTherapists ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune inscription</p>
            )}
          </CardContent>
        </Card>

        <Card style={SURFACE}>
          <CardHeader><CardTitle>5 dernières réservations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data?.lastAppointments ?? []).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <div className="font-medium">{a.patient_name}</div>
                  <div className="text-xs text-muted-foreground">{a.appointment_date} · {a.appointment_time}</div>
                </div>
                <Badge variant="outline">{a.status}</Badge>
              </div>
            ))}
            {!isLoading && (data?.lastAppointments ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune réservation</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
