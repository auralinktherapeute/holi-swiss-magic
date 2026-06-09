import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, CreditCard, Download } from "lucide-react";

export const Route = createFileRoute("/dashboard/abonnement")({ component: Page });

const PLANS = [
  { id: "free", name: "Free", price: "0", features: ["Fiche basique", "1 photo", "Visible dans l'annuaire"] },
  { id: "pro", name: "Pro", price: "29", features: ["Fiche enrichie", "10 photos", "Réservation en ligne", "Articles illimités", "Statistiques avancées"], current: true },
  { id: "premium", name: "Premium", price: "59", features: ["Tout Pro", "Mise en avant", "Badge vérifié", "Support prioritaire"] },
];

const INVOICES = [
  { id: "INV-0023", date: "01 juin 2026", amount: "29.00 CHF" },
  { id: "INV-0022", date: "01 mai 2026", amount: "29.00 CHF" },
  { id: "INV-0021", date: "01 avr. 2026", amount: "29.00 CHF" },
];

function Page() {
  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Abonnement</h1>
        <p className="text-muted-foreground mt-1">Plan actif et facturation</p>
      </div>

      <Card className="bg-gradient-to-br from-[#522870] to-[#3d1a5c] border-primary/40 shadow-[0_0_30px_rgba(184,110,249,0.25)]">
        <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center"><Sparkles className="h-6 w-6 text-primary" /></div>
            <div>
              <Badge className="bg-primary/20 text-primary border-primary/30 mb-1">Plan actif</Badge>
              <div className="text-2xl font-bold text-foreground">Pro · 29 CHF / mois</div>
              <div className="text-sm text-muted-foreground">Prochain prélèvement le 1er juillet 2026</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">Changer de moyen de paiement</Button>
            <Button variant="ghost">Annuler</Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Tous les plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => (
            <Card key={p.id} className={`bg-surface border ${p.current ? "border-primary shadow-[0_0_30px_rgba(184,110,249,0.25)]" : "border-border/60"}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  {p.current && <Badge className="bg-primary text-primary-foreground">Actif</Badge>}
                </div>
                <div className="mt-2"><span className="text-3xl font-bold text-foreground">{p.price}</span><span className="text-muted-foreground"> CHF / mois</span></div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2"><Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /><span className="text-foreground/80">{f}</span></li>
                  ))}
                </ul>
                {!p.current && <Button className="w-full bg-primary hover:bg-primary/90">Choisir {p.name}</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="bg-surface border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Factures</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {INVOICES.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 p-3">
              <div>
                <div className="font-medium text-foreground">{i.id}</div>
                <div className="text-xs text-muted-foreground">{i.date}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-foreground/80">{i.amount}</div>
                <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
