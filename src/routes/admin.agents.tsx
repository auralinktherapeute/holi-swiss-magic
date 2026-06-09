import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bot, MessageSquare, ShieldCheck, FileSearch, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/agents")({ component: Page });

const AGENTS = [
  { id: "mod", name: "Modérateur LPMéd", icon: ShieldCheck, desc: "Détecte les termes médicaux interdits dans les avis et articles", runs: "1 247 / 30j", enabled: true },
  { id: "match", name: "Matching visiteur ↔ thérapeute", icon: Sparkles, desc: "Suggère les thérapeutes pertinents selon la demande du visiteur", runs: "832 / 30j", enabled: true },
  { id: "support", name: "Assistant support", icon: MessageSquare, desc: "Répond aux questions courantes des visiteurs", runs: "418 / 30j", enabled: false },
  { id: "seo", name: "Optimiseur SEO articles", icon: FileSearch, desc: "Suggère titres et meta descriptions pour les articles thérapeutes", runs: "94 / 30j", enabled: true },
];

function Page() {
  const [agents, setAgents] = useState(AGENTS);
  const toggle = (id: string) => setAgents((a) => a.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Agents IA</h1>
          <p className="text-muted-foreground">Powered by Lovable AI Gateway</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.map((a) => {
          const Icon = a.icon;
          return (
            <Card key={a.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center"><Icon className="h-5 w-5 text-primary" /></div>
                  <div>
                    <CardTitle className="text-base">{a.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{a.desc}</p>
                  </div>
                </div>
                <Switch checked={a.enabled} onCheckedChange={() => toggle(a.id)} />
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Badge variant={a.enabled ? "default" : "secondary"}>{a.enabled ? "Actif" : "Désactivé"}</Badge>
                <span className="text-xs text-muted-foreground">{a.runs}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Prompt système global</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="sp" className="text-xs text-muted-foreground">Appliqué à tous les agents (compliance LPMéd)</Label>
          <Textarea id="sp" rows={6} defaultValue="Vous êtes un agent au service de Holiswiss, annuaire suisse de thérapeutes en approches complémentaires. Vous devez impérativement éviter tout vocabulaire médical réservé (soin, guérison, traitement, diagnostic, prescription) conformément à la LPMéd." />
          <div className="flex justify-end"><Button onClick={() => toast.success("Prompt sauvegardé")} className="bg-primary hover:bg-primary/90">Enregistrer</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
