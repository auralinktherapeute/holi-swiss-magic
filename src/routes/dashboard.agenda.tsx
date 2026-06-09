import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/agenda")({ component: Page });

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

type Slot = { day: string; on: boolean; from: string; to: string };

function Page() {
  const [slots, setSlots] = useState<Slot[]>(
    DAYS.map((d, i) => ({ day: d, on: i < 5, from: "09:00", to: "18:00" })),
  );
  const update = (i: number, patch: Partial<Slot>) =>
    setSlots((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agenda & disponibilités</h1>
        <p className="text-muted-foreground mt-1">Vos créneaux apparaissent aux visiteurs lors d'une réservation</p>
      </div>

      <Card className="bg-surface border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Horaires hebdomadaires</CardTitle>
          <Badge className="bg-primary-xlight text-primary border-primary/20">Fuseau Europe/Zurich</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {slots.map((s, i) => (
            <div key={s.day} className="flex flex-wrap items-center gap-4 rounded-lg border border-border/60 bg-background/40 p-4">
              <div className="w-28 font-medium text-foreground">{s.day}</div>
              <Switch checked={s.on} onCheckedChange={(v) => update(i, { on: v })} />
              {s.on ? (
                <div className="flex items-center gap-2">
                  <Input type="time" value={s.from} onChange={(e) => update(i, { from: e.target.value })} className="w-32" />
                  <span className="text-muted-foreground">→</span>
                  <Input type="time" value={s.to} onChange={(e) => update(i, { to: e.target.value })} className="w-32" />
                </div>
              ) : <span className="text-sm text-muted-foreground">Fermé</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-surface border-border/60">
        <CardHeader><CardTitle>Périodes d'indisponibilité</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Du</label><Input type="date" /></div>
            <div className="space-y-1"><label className="text-xs text-muted-foreground">Au</label><Input type="date" /></div>
            <Button variant="secondary">Ajouter</Button>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
            Aucune période bloquée
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => toast.success("Agenda enregistré (démo)")} className="bg-primary hover:bg-primary/90">Enregistrer</Button>
      </div>
    </div>
  );
}
