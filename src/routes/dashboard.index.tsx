import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, CalendarCheck, Star, TrendingUp, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/dashboard/")({ component: Page });

const stats = [
  { label: "Vues du profil (30j)", value: "1 248", delta: "+12%", icon: Eye },
  { label: "Réservations (30j)", value: "37", delta: "+8%", icon: CalendarCheck },
  { label: "Note moyenne", value: "4,8", delta: "23 avis", icon: Star },
  { label: "Taux de conversion", value: "3,0%", delta: "+0,4 pt", icon: TrendingUp },
];

const upcoming = [
  { name: "Marie L.", when: "Aujourd'hui · 14:00", type: "Première séance" },
  { name: "Jean P.", when: "Demain · 09:30", type: "Suivi" },
  { name: "Sophie K.", when: "Jeu. 12 · 16:00", type: "Suivi" },
];

function Page() {
  return (
    <div className="p-6 md:p-10 space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bonjour 👋</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble de votre activité</p>
        </div>
        <Badge variant="secondary" className="bg-primary-xlight text-primary border-primary/20">Plan Pro · actif</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-surface border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{s.delta}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-surface border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Prochaines réservations</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/reservations">Tout voir <ArrowUpRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcoming.map((u) => (
              <div key={u.name} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-4">
                <div>
                  <div className="font-medium text-foreground">{u.name}</div>
                  <div className="text-sm text-muted-foreground">{u.type}</div>
                </div>
                <div className="text-sm text-foreground/80">{u.when}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-surface border-border/60">
          <CardHeader><CardTitle>Actions rapides</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start" variant="secondary"><Link to="/dashboard/profil">Compléter mon profil</Link></Button>
            <Button asChild className="w-full justify-start" variant="secondary"><Link to="/dashboard/agenda">Mettre à jour l'agenda</Link></Button>
            <Button asChild className="w-full justify-start" variant="secondary"><Link to="/dashboard/articles">Écrire un article</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
