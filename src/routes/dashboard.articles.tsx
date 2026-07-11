import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Send, ExternalLink, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listMyTherapistArticles, upsertMyTherapistArticle, deleteMyTherapistArticle,
  type TherapistArticle,
} from "@/lib/therapist-articles.functions";

export const Route = createFileRoute("/dashboard/articles")({ component: Page });

const STATUS_META: Record<TherapistArticle["statut"], { label: string; className: string }> = {
  brouillon:              { label: "Brouillon",       className: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
  en_attente_validation:  { label: "En attente",      className: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  publie:                 { label: "Publié",          className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  refuse:                 { label: "Refusé",          className: "bg-red-500/15 text-red-300 border-red-500/30" },
};

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listMyTherapistArticles);
  const upsert = useServerFn(upsertMyTherapistArticle);
  const remove = useServerFn(deleteMyTherapistArticle);

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["my-therapist-articles"],
    queryFn: () => list(),
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TherapistArticle | null>(null);
  const [titre, setTitre] = useState("");
  const [contenu, setContenu] = useState("");
  const [extrait, setExtrait] = useState("");
  const [image, setImage] = useState("");

  const resetForm = () => {
    setEditing(null);
    setTitre(""); setContenu(""); setExtrait(""); setImage("");
  };
  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (a: TherapistArticle) => {
    setEditing(a);
    setTitre(a.titre); setContenu(a.contenu);
    setExtrait(a.extrait ?? ""); setImage(a.image_couverture ?? "");
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (submit: boolean) =>
      upsert({ data: {
        id: editing?.id,
        titre, contenu,
        extrait: extrait || null,
        image_couverture: image || null,
        submit,
      } as any }),
    onSuccess: (_res, submit) => {
      toast.success(submit ? "Article soumis à validation" : "Brouillon enregistré");
      setOpen(false); resetForm();
      qc.invalidateQueries({ queryKey: ["my-therapist-articles"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Article supprimé");
      qc.invalidateQueries({ queryKey: ["my-therapist-articles"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Mes articles</h1>
          <p className="text-muted-foreground mt-1">Publiez vos articles sur "Voix d'experts" après validation par l'équipe Holiswiss.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="bg-primary hover:bg-primary/90"><Plus className="h-4 w-4 mr-2" />Nouvel article</Button>
          </DialogTrigger>
          <DialogContent className="bg-surface border-border/60 max-w-2xl">
            <DialogHeader><DialogTitle>{editing ? "Modifier l'article" : "Nouvel article"}</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); save.mutate(false); }}
              className="space-y-4"
            >
              <div className="space-y-2"><Label htmlFor="t">Titre</Label>
                <Input id="t" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Mon titre…" required minLength={3} maxLength={200} />
              </div>
              <div className="space-y-2"><Label htmlFor="i">Image de couverture (URL, optionnel)</Label>
                <Input id="i" type="url" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…" />
              </div>
              <div className="space-y-2"><Label htmlFor="x">Extrait (optionnel, 400 caractères max)</Label>
                <Textarea id="x" value={extrait} onChange={(e) => setExtrait(e.target.value)} rows={2} maxLength={400} placeholder="Résumé court affiché dans la liste…" />
              </div>
              <div className="space-y-2"><Label htmlFor="b">Contenu</Label>
                <Textarea id="b" value={contenu} onChange={(e) => setContenu(e.target.value)} rows={12} placeholder="Rédigez votre article…" required minLength={20} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Annuler</Button>
                <Button type="submit" variant="secondary" disabled={save.isPending}>Enregistrer en brouillon</Button>
                <Button
                  type="button"
                  onClick={() => save.mutate(true)}
                  disabled={save.isPending || titre.trim().length < 3 || contenu.trim().length < 20}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Send className="h-4 w-4 mr-2" />Soumettre à validation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {isLoading && (
          <Card className="bg-surface border-border/60"><CardContent className="p-6 text-muted-foreground">Chargement…</CardContent></Card>
        )}
        {!isLoading && articles.length === 0 && (
          <Card className="bg-surface border-border/60"><CardContent className="p-8 text-center text-muted-foreground">
            Vous n'avez pas encore d'article. Rédigez votre premier article !
          </CardContent></Card>
        )}
        {articles.map((a) => (
          <Card key={a.id} className="bg-surface border-border/60">
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={STATUS_META[a.statut].className}>
                    {STATUS_META[a.statut].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    MAJ {new Date(a.updated_at).toLocaleDateString("fr-CH")}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-foreground truncate">{a.titre}</h3>
                {a.statut === "refuse" && a.motif_refus && (
                  <div className="text-xs text-red-300 flex items-start gap-1 mt-1">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span><strong>Motif du refus&nbsp;:</strong> {a.motif_refus}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {a.statut === "publie" && (
                  <a href={`/fr/paroles/${a.slug}`} target="_blank" rel="noreferrer">
                    <Button size="sm" variant="ghost"><ExternalLink className="h-4 w-4 mr-1" />Voir</Button>
                  </a>
                )}
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>
                  <Pencil className="h-4 w-4 mr-1" />Éditer
                </Button>
                <Button
                  size="sm" variant="ghost"
                  onClick={() => { if (confirm("Supprimer cet article ?")) del.mutate(a.id); }}
                  className="text-red-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
