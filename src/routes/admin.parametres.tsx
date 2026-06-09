import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/parametres")({ component: Page });

type Settings = {
  siteName: string; contactEmail: string; prodUrl: string;
  priceFree: number; pricePro: number; pricePremium: number;
  maintenance: boolean; retentionMonths: number;
};
const DEFAULTS: Settings = {
  siteName: "Holiswiss", contactEmail: "contact@holiswiss.ch", prodUrl: "https://holiswiss.ch",
  priceFree: 0, pricePro: 29, pricePremium: 59, maintenance: false, retentionMonths: 36,
};
const KEY = "holiswiss:admin-settings";
const SURFACE = { background: "#160d2b", border: "1px solid rgba(184,110,249,0.20)" };

function Page() {
  const [s, setS] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify(s));
    toast.success("Paramètres enregistrés (local)");
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-4xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Paramètres</h1>
          <p className="text-muted-foreground mt-1">Configuration globale du site</p>
        </div>
        <Badge variant="outline" className="bg-yellow-500/15 text-yellow-300 border-yellow-500/30">
          ⚠ Données locales (démo)
        </Badge>
      </div>

      <Card style={SURFACE}>
        <CardHeader><CardTitle>Site</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="siteName">Nom du site</Label>
            <Input id="siteName" value={s.siteName} onChange={(e) => setS({ ...s, siteName: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="contactEmail">Email de contact</Label>
            <Input id="contactEmail" type="email" value={s.contactEmail} onChange={(e) => setS({ ...s, contactEmail: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="prodUrl">URL de production</Label>
            <Input id="prodUrl" type="url" value={s.prodUrl} onChange={(e) => setS({ ...s, prodUrl: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card style={SURFACE}>
        <CardHeader><CardTitle>Plans tarifaires (CHF/mois)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Free</Label>
            <Input type="number" min={0} value={s.priceFree} onChange={(e) => setS({ ...s, priceFree: Number(e.target.value) })} /></div>
          <div className="space-y-2"><Label>Pro</Label>
            <Input type="number" min={0} value={s.pricePro} onChange={(e) => setS({ ...s, pricePro: Number(e.target.value) })} /></div>
          <div className="space-y-2"><Label>Premium</Label>
            <Input type="number" min={0} value={s.pricePremium} onChange={(e) => setS({ ...s, pricePremium: Number(e.target.value) })} /></div>
        </CardContent>
      </Card>

      <Card style={SURFACE}>
        <CardHeader><CardTitle>Maintenance & RGPD</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Mode maintenance</Label>
              <p className="text-xs text-muted-foreground">Affiche une page de maintenance aux visiteurs</p>
            </div>
            <Switch checked={s.maintenance} onCheckedChange={(v) => setS({ ...s, maintenance: v })} />
          </div>
          <div className="space-y-2"><Label htmlFor="retention">Durée de rétention des données (mois)</Label>
            <Input id="retention" type="number" min={1} max={120} value={s.retentionMonths}
              onChange={(e) => setS({ ...s, retentionMonths: Number(e.target.value) })} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setS(DEFAULTS)}>Réinitialiser</Button>
        <Button onClick={save}>Enregistrer</Button>
      </div>
    </div>
  );
}
