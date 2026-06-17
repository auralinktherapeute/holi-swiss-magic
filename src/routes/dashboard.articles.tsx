import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import { useSessionState } from "@/hooks/use-session-state";

export const Route = createFileRoute("/dashboard/articles")({ component: Page });

type Article = { id: string; title: string; status: "draft" | "published"; updated: string; views: number };

const ARTICLES: Article[] = [
  { id: "1", title: "Cinq exercices de respiration pour démarrer la journée", status: "published", updated: "il y a 3 j", views: 412 },
  { id: "2", title: "Méditation guidée : ancrage en pleine conscience", status: "published", updated: "il y a 1 sem", views: 287 },
  { id: "3", title: "Brouillon : sophrologie et sommeil", status: "draft", updated: "hier", views: 0 },
];

function Page() {
  const [open, setOpen] = useSessionState("dashboard.articles.dialogOpen", false);
  const [title, setTitle] = useSessionState("dashboard.articles.title", "");
  const [body, setBody] = useSessionState("dashboard.articles.body", "");
  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Articles</h1>
          <p className="text-muted-foreground mt-1">Partagez votre approche et boostez votre visibilité</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" />Nouvel article</Button>
          </DialogTrigger>
          <DialogContent className="bg-surface border-border/60 max-w-2xl">
            <DialogHeader><DialogTitle>Nouvel article</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); setOpen(false); toast.success("Brouillon enregistré"); }} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="t">Titre</Label><Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mon titre…" required /></div>
              <div className="space-y-2"><Label htmlFor="b">Contenu</Label><Textarea id="b" value={body} onChange={(e) => setBody(e.target.value)} rows={10} placeholder="Rédigez votre article…" required /></div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" variant="secondary">Enregistrer en brouillon</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90">Publier</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {ARTICLES.map((a) => (
          <Card key={a.id} className="bg-surface border-border/60">
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={a.status === "published" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"}>
                    {a.status === "published" ? "Publié" : "Brouillon"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">MAJ {a.updated}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground truncate">{a.title}</h3>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{a.views} vues</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost"><Pencil className="h-4 w-4 mr-1" />Éditer</Button>
                {a.status === "draft" && <Button size="sm" className="bg-primary hover:bg-primary/90">Publier</Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
