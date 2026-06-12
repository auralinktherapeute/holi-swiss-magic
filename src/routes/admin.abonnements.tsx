import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Users, TrendingUp, AlertCircle, ExternalLink } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/admin/abonnements")({ component: Page });

const STATS = [
  { label: "MRR", value: "3 248 CHF", icon: TrendingUp, delta: "+8% vs mois -1" },
  { label: "Abonnés actifs", value: "112", icon: Users, delta: "98 Pro · 14 Premium" },
  { label: "Churn (30j)", value: "2,1%", icon: AlertCircle, delta: "Stable" },
  { label: "Échecs paiement", value: "3", icon: CreditCard, delta: "À relancer" },
];

const SUBS = [
  { id: "sub_001", customer: "Claire Dupont", plan: "Essentiel", amount: "49 CHF", status: "active", next: "01 juil. 2026" },
  { id: "sub_002", customer: "Anna Bianchi", plan: "Elite Pro", amount: "99 CHF", status: "active", next: "12 juin 2026" },
  { id: "sub_003", customer: "Marc Reber", plan: "Essentiel", amount: "49 CHF", status: "past_due", next: "—" },
  { id: "sub_004", customer: "Sofia Rossi", plan: "Essentiel", amount: "49 CHF", status: "canceled", next: "—" },
];

const PLAN_REPARTITION = [
  { name: "Basic", value: 124, color: "#475569" },
  { name: "Essentiel", value: 98, color: "#b86ef9" },
  { name: "Elite Pro", value: 14, color: "#f0b429" },
];

const STATUS_CLS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  past_due: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  canceled: "bg-red-500/15 text-red-300 border-red-500/30",
};

function Page() {
  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Abonnements Stripe</h1>
          <p className="text-muted-foreground mt-1">Vue d'ensemble facturation & subscriptions</p>
        </div>
        <Badge variant="outline" className="bg-yellow-500/15 text-yellow-300 border-yellow-500/30">⚠ Stripe non connecté (données démo)</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{s.delta}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Abonnements récents</CardTitle>
          <Button variant="secondary" size="sm"><ExternalLink className="h-4 w-4 mr-1" />Ouvrir Stripe</Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Client</TableHead><TableHead>Plan</TableHead><TableHead>Montant</TableHead>
              <TableHead>Statut</TableHead><TableHead>Prochain prélèvement</TableHead><TableHead>ID</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {SUBS.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.customer}</TableCell>
                  <TableCell><Badge variant="secondary">{s.plan}</Badge></TableCell>
                  <TableCell>{s.amount}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_CLS[s.status]}>{s.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{s.next}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.id}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Répartition par plan</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={PLAN_REPARTITION} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {PLAN_REPARTITION.map((p) => <Cell key={p.name} fill={p.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#160d2b", border: "1px solid rgba(184,110,249,0.3)" }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
