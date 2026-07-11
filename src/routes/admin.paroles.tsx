import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminListTherapistArticles,
  adminModerateTherapistArticle,
} from "@/lib/therapist-articles.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Eye, Mic } from "lucide-react";

export const Route = createFileRoute("/admin/paroles")({ component: Page });

const STATUS_TABS = [
  { key: "en_attente_validation", label: "En attente" },
  { key: "publie", label: "Publiés" },
  { key: "refuse", label: "Refusés" },
  { key: "brouillon", label: "Brouillons" },
] as const;

function Page() {
  const [tab, setTab] = useState<typeof STATUS_TABS[number]["key"]>("en_attente_validation");
  const [preview, setPreview] = useState<any | null>(null);
  const [rejectFor, setRejectFor] = useState<any | null>(null);
  const [motif, setMotif] = useState("");
  const qc = useQueryClient();

  const list = useServerFn(adminListTherapistArticles);
  const moderate = useServerFn(adminModerateTherapistArticle);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-therapist-articles", tab],
    queryFn: () => list({ data: { statut: tab } }),
  });

  const act = useMutation({
    mutationFn: async (payload: { id: string; action: "publish" | "reject"; motif_refus?: string | null }) =>
      moderate({ data: payload }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "publish" ? "Article publié" : "Article refusé");
      setRejectFor(null); setMotif(""); setPreview(null);
      qc.invalidateQueries({ queryKey: ["admin-therapist-articles"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <div className="p-6 md:p-10 space-y-6 text-white">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Mic className="h-7 w-7 text-[#b86ef9]" /> Voix d'experts — Modération</h1>
        <p className="text-white/60 mt-1">Articles rédigés par les thérapeutes en attente de validation.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            onClick={() => setTab(s.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === s.key ? "bg-[#b86ef9] text-white" : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4">
        {isLoading && <Card className="bg-[#1d0d3d] border-white/10"><CardContent className="p-6 text-white/60">Chargement…</CardContent></Card>}
        {!isLoading && rows.length === 0 && (
          <Card className="bg-[#1d0d3d] border-white/10"><CardContent className="p-8 text-center text-white/60">Aucun article.</CardContent></Card>
        )}
        {rows.map((a: any) => {
          const t = a.therapists;
          const name = t ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : "—";
          return (
            <Card key={a.id} className="bg-[#1d0d3d] border-white/10">
              <CardContent className="p-5 flex flex-wrap items-start gap-4">
                {a.image_couverture && (
                  <img src={a.image_couverture} alt="" className="h-20 w-32 rounded-lg object-cover" />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="border-white/20 text-white/80">{a.statut}</Badge>
                    <span className="text-xs text-white/50">
                      Soumis le {a.date_soumission ? new Date(a.date_soumission).toLocaleDateString("fr-CH") : "—"}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold truncate">{a.titre}</h3>
                  <div className="text-sm text-white/60">Par {name}{t?.city ? ` · ${t.city}` : ""}</div>
                  {a.motif_refus && (
                    <div className="text-xs text-red-300 mt-1"><strong>Motif refus&nbsp;:</strong> {a.motif_refus}</div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => setPreview(a)} className="text-white hover:bg-white/10">
                    <Eye className="h-4 w-4 mr-1" />Prévisualiser
                  </Button>
                  {a.statut !== "publie" && (
                    <Button size="sm" onClick={() => act.mutate({ id: a.id, action: "publish" })}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      <Check className="h-4 w-4 mr-1" />Publier
                    </Button>
                  )}
                  {a.statut !== "refuse" && (
                    <Button size="sm" variant="destructive" onClick={() => { setRejectFor(a); setMotif(""); }}>
                      <X className="h-4 w-4 mr-1" />Refuser
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Prévisualisation */}
      <Dialog open={!!preview} onOpenChange={(v) => { if (!v) setPreview(null); }}>
        <DialogContent className="bg-[#1d0d3d] border-white/10 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{preview?.titre}</DialogTitle></DialogHeader>
          {preview?.image_couverture && (
            <img src={preview.image_couverture} alt="" className="w-full rounded-lg mb-4" />
          )}
          {preview?.extrait && <p className="italic text-white/70 mb-4">{preview.extrait}</p>}
          <div className="whitespace-pre-wrap text-white/90 leading-relaxed">{preview?.contenu}</div>
        </DialogContent>
      </Dialog>

      {/* Motif refus */}
      <Dialog open={!!rejectFor} onOpenChange={(v) => { if (!v) { setRejectFor(null); setMotif(""); } }}>
        <DialogContent className="bg-[#1d0d3d] border-white/10 text-white">
          <DialogHeader><DialogTitle>Refuser l'article</DialogTitle></DialogHeader>
          <p className="text-sm text-white/70">Indiquez au thérapeute le motif du refus. Il sera visible dans son tableau de bord.</p>
          <Textarea rows={5} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={500} placeholder="Ex. Le contenu manque de sources vérifiables…" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectFor(null); setMotif(""); }}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={motif.trim().length < 5}
              onClick={() => act.mutate({ id: rejectFor.id, action: "reject", motif_refus: motif.trim() })}
            >
              Refuser l'article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}