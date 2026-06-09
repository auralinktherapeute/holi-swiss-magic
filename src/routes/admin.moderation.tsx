import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Check, X, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/moderation")({ component: Page });

type Item = { id: string; type: "review" | "article"; author: string; preview: string; flag: string; created: string; rating?: number };

const ITEMS: Item[] = [
  { id: "r1", type: "review", author: "Marie L.", preview: "Cette personne est incompétente, elle prétend pouvoir guérir n'importe quoi…", flag: "Termes médicaux interdits", created: "il y a 2 h", rating: 1 },
  { id: "a1", type: "article", author: "Claire Dupont", preview: "Comment traiter l'anxiété en 5 séances — résultats garantis", flag: "Promesse de résultat + vocabulaire LPMéd", created: "il y a 5 h" },
  { id: "r2", type: "review", author: "Anonyme", preview: "Excellent accompagnement, je recommande chaleureusement !", flag: "Signalé par un utilisateur", created: "il y a 1 j", rating: 5 },
];

function Page() {
  const [tab, setTab] = useState<"all" | "review" | "article">("all");
  const list = tab === "all" ? ITEMS : ITEMS.filter((i) => i.type === tab);

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">File de modération</h1>
          <p className="text-muted-foreground">{ITEMS.length} éléments en attente — conformité LPMéd</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "review" | "article")}>
        <TabsList>
          <TabsTrigger value="all">Tout ({ITEMS.length})</TabsTrigger>
          <TabsTrigger value="review">Avis ({ITEMS.filter(i => i.type === "review").length})</TabsTrigger>
          <TabsTrigger value="article">Articles ({ITEMS.filter(i => i.type === "article").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-3">
        {list.map((it) => (
          <Card key={it.id}>
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{it.type === "review" ? "Avis" : "Article"}</Badge>
                <Badge variant="outline" className="bg-red-500/15 text-red-300 border-red-500/30">⚠ {it.flag}</Badge>
                {it.rating !== undefined && (
                  <span className="flex items-center gap-0.5 text-yellow-300 text-xs">
                    {Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-3 w-3 ${i < it.rating! ? "fill-current" : "opacity-30"}`} />)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{it.created}</span>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">par {it.author}</div>
                <p className="text-foreground">{it.preview}</p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button size="sm" variant="ghost" onClick={() => toast(`${it.type === "review" ? "Avis" : "Article"} supprimé`)}><X className="h-4 w-4 mr-1" />Supprimer</Button>
                <Button size="sm" onClick={() => toast.success("Approuvé")} className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"><Check className="h-4 w-4 mr-1" />Approuver</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
