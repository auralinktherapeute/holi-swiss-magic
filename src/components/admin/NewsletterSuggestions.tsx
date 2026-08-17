import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Lightbulb,
  RefreshCw,
  Trash2,
  PencilLine,
  ArrowRight,
  Undo2,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ActionTooltip } from "@/components/admin/ActionTooltip";
import {
  listNewsletterSuggestions,
  saveNewsletterSuggestion,
  setNewsletterSuggestionStatus,
  deleteNewsletterSuggestion,
  refreshNewsletterSuggestions,
  createBriefFromSuggestion,
} from "@/lib/newsletter-connection.functions";
import {
  HOLISWISS_FEATURES,
  findFeature,
  CONNECTION_PRIORITIES,
  PRIORITY_LABELS,
  SUGGESTION_STATUS_LABELS,
  type NewsletterSuggestion,
} from "@/lib/holiswiss-features.shared";
import { NEWSLETTER_PILLARS } from "@/lib/newsletter.shared";

const inputCls =
  "bg-white/5 border-white/10 text-white placeholder:text-white/35 focus-visible:ring-[#b86ef9]";
const selectCls =
  "h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]";

type Draft = {
  id?: string;
  subject: string;
  audience: string;
  pillar: string;
  feature_key: string;
  objective: string;
  rationale: string;
  priority: "basse" | "moyenne" | "haute";
};

const EMPTY: Draft = {
  subject: "",
  audience: "",
  pillar: "",
  feature_key: "",
  objective: "",
  rationale: "",
  priority: "moyenne",
};

const PRIORITY_COLORS: Record<string, string> = {
  haute: "bg-[#f87171]/15 text-[#f87171]",
  moyenne: "bg-[#fbbf24]/15 text-[#fbbf24]",
  basse: "bg-white/10 text-white/60",
};

export function NewsletterSuggestions() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listNewsletterSuggestions);
  const save = useServerFn(saveNewsletterSuggestion);
  const setStatus = useServerFn(setNewsletterSuggestionStatus);
  const remove = useServerFn(deleteNewsletterSuggestion);
  const refresh = useServerFn(refreshNewsletterSuggestions);
  const toBrief = useServerFn(createBriefFromSuggestion);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [showDismissed, setShowDismissed] = useState(false);
  const [toDelete, setToDelete] = useState<NewsletterSuggestion | null>(null);
  const [toDismiss, setToDismiss] = useState<NewsletterSuggestion | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const q = useQuery({ queryKey: ["newsletter-suggestions"], queryFn: () => list() });
  const allRows = (q.data?.rows ?? []) as NewsletterSuggestion[];
  const rows = allRows.filter((r) => (showDismissed ? true : r.status !== "rejetee"));
  const dismissedCount = allRows.filter((r) => r.status === "rejetee").length;

  const invalidate = () => qc.invalidateQueries({ queryKey: ["newsletter-suggestions"] });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Action impossible.");

  const mRefresh = useMutation({
    mutationFn: () => refresh(),
    onSuccess: (r) => {
      setLastRefresh(new Date());
      toast.success(
        r.added > 0
          ? `${r.added} nouvelle(s) suggestion(s). Aucune suggestion existante n'a été supprimée.`
          : "Aucune nouvelle suggestion. La liste existante est inchangée.",
      );
      invalidate();
    },
    onError,
  });
  const mSave = useMutation({
    mutationFn: (d: Draft) => save({ data: d }),
    onSuccess: () => {
      toast.success("Suggestion enregistrée.");
      setOpen(false);
      setDraft(EMPTY);
      invalidate();
    },
    onError,
  });
  const mDismiss = useMutation({
    mutationFn: (id: string) => setStatus({ data: { id, status: "rejetee" as const } }),
    onSuccess: () => {
      toast.success("Suggestion écartée — récupérable via « Afficher les écartées ».");
      setToDismiss(null);
      invalidate();
    },
    onError,
  });
  const mRestore = useMutation({
    mutationFn: (id: string) => setStatus({ data: { id, status: "ouverte" as const } }),
    onSuccess: () => {
      toast.success("Suggestion remise dans la liste.");
      invalidate();
    },
    onError,
  });
  const mDelete = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Suggestion supprimée définitivement.");
      setToDelete(null);
      invalidate();
    },
    onError,
  });
  const mBrief = useMutation({
    mutationFn: (id: string) => toBrief({ data: { id } }),
    onSuccess: (r) => {
      toast.success(
        "Le brief a été créé. Vous pouvez maintenant le compléter avant de générer le contenu.",
      );
      invalidate();
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issues"] });
      navigate({ to: "/admin/newsletter/$id", params: { id: r.id } });
    },
    onError,
  });

  return (
    <Card className="bg-[#1d0d3d] border-white/10">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[#fbbf24]" aria-hidden="true" />
            <h2 className="font-semibold">Suggestions de sujets</h2>
            <Badge className="bg-white/10 text-white/70 border-0">{rows.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionTooltip label="Recalcule les suggestions à partir des données récentes. N'écrase aucune suggestion existante et ne génère aucune newsletter.">
              <Button
                variant="outline"
                aria-label="Actualiser les suggestions"
                aria-busy={mRefresh.isPending}
                disabled={mRefresh.isPending}
                onClick={() => mRefresh.mutate()}
                className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${mRefresh.isPending ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {mRefresh.isPending ? "Analyse en cours…" : "Actualiser les suggestions"}
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Créer manuellement une suggestion de sujet. Aucun contenu n'est généré.">
              <Button
                aria-label="Ajouter un sujet de suggestion"
                onClick={() => {
                  setDraft(EMPTY);
                  setOpen(true);
                }}
                className="min-h-11 bg-white/10 hover:bg-white/20 text-white"
              >
                Ajouter un sujet
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Afficher ou masquer les suggestions écartées afin de pouvoir les restaurer.">
              <Button
                variant="outline"
                aria-pressed={showDismissed}
                aria-label={
                  showDismissed
                    ? "Masquer les suggestions écartées"
                    : `Afficher les ${dismissedCount} suggestions écartées`
                }
                onClick={() => setShowDismissed((v) => !v)}
                className="min-h-11 border-white/15 bg-transparent text-white/80 hover:bg-white/10"
              >
                <EyeOff className="h-4 w-4 mr-2" aria-hidden="true" />
                {showDismissed
                  ? "Masquer les écartées"
                  : `Afficher les écartées (${dismissedCount})`}
              </Button>
            </ActionTooltip>
          </div>
        </div>

        <p className="text-xs text-white/45" aria-live="polite">
          {mRefresh.isPending
            ? "Actualisation en cours…"
            : lastRefresh
              ? `Dernière actualisation : ${lastRefresh.toLocaleString("fr-CH")}`
              : "Aucune actualisation depuis l'ouverture de la page."}
        </p>

        <p className="text-xs text-white/45">
          Les suggestions sont calculées sur des totaux anonymes. Aucune newsletter n'est générée ni
          envoyée automatiquement. « Créer un brief » ouvre un brouillon éditable · « Écarter »
          masque la suggestion et reste réversible · « Supprimer » est définitif et demande une
          confirmation.
        </p>

        {q.isLoading && <p className="text-sm text-white/60">Chargement…</p>}
        {!q.isLoading && rows.length === 0 && (
          <p className="text-sm text-white/60">
            Aucune suggestion pour le moment — lancez une actualisation.
          </p>
        )}

        <ul className="grid gap-3">
          {rows.map((s) => {
            const feature = findFeature(s.feature_key);
            return (
              <li
                key={s.id}
                className="rounded-lg border border-white/10 bg-white/5 p-4 flex flex-wrap gap-3"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white">{s.subject}</span>
                    <Badge className={`${PRIORITY_COLORS[s.priority] ?? ""} border-0`}>
                      {PRIORITY_LABELS[s.priority] ?? s.priority}
                    </Badge>
                    {s.status !== "ouverte" && (
                      <Badge className="bg-white/10 text-white/60 border-0">
                        {SUGGESTION_STATUS_LABELS[s.status] ?? s.status}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-white/55 flex flex-wrap gap-x-3 gap-y-1">
                    {s.audience && <span>Public : {s.audience}</span>}
                    {s.pillar && <span>Pilier : {s.pillar}</span>}
                    {feature && <span>Fonctionnalité : {feature.label}</span>}
                    {s.objective && <span>Objectif : {s.objective}</span>}
                  </div>
                  {s.rationale && <p className="text-xs text-white/40">{s.rationale}</p>}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {s.issue_id ? (
                    <ActionTooltip label="Un brief a déjà été créé à partir de cette suggestion. Ouvrir le brief existant plutôt que d'en créer un second.">
                      <Button
                        aria-label={`Ouvrir le brief existant créé depuis « ${s.subject} »`}
                        onClick={() =>
                          navigate({
                            to: "/admin/newsletter/$id",
                            params: { id: s.issue_id as string },
                          })
                        }
                        className="min-h-11 bg-[#4ade80]/15 hover:bg-[#4ade80]/25 text-[#4ade80]"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                        Ouvrir le brief créé
                      </Button>
                    </ActionTooltip>
                  ) : (
                    <ActionTooltip label="Crée un brief de newsletter prérempli (sujet, public cible, pilier éditorial, fonctionnalité, objectif) puis l'ouvre en édition. Aucun contenu n'est généré, aucun envoi n'est déclenché.">
                      <Button
                        aria-label={`Créer un brief à partir de la suggestion « ${s.subject} »`}
                        aria-busy={mBrief.isPending}
                        disabled={mBrief.isPending}
                        onClick={() => mBrief.mutate(s.id)}
                        className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
                      >
                        <ArrowRight className="h-4 w-4 mr-2" aria-hidden="true" />
                        {mBrief.isPending ? "Création…" : "Créer un brief"}
                      </Button>
                    </ActionTooltip>
                  )}
                  <ActionTooltip label="Modifier cette suggestion">
                    <Button
                      variant="outline"
                      aria-label={`Modifier la suggestion « ${s.subject} »`}
                      onClick={() => {
                        setDraft({
                          id: s.id,
                          subject: s.subject,
                          audience: s.audience ?? "",
                          pillar: s.pillar ?? "",
                          feature_key: s.feature_key ?? "",
                          objective: s.objective ?? "",
                          rationale: s.rationale ?? "",
                          priority: (s.priority as Draft["priority"]) ?? "moyenne",
                        });
                        setOpen(true);
                      }}
                      className="min-h-11 min-w-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                    >
                      <PencilLine className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </ActionTooltip>
                  {s.status === "rejetee" ? (
                    <ActionTooltip label="Remettre cette suggestion dans la liste des suggestions prioritaires.">
                      <Button
                        variant="outline"
                        aria-label={`Restaurer la suggestion « ${s.subject} »`}
                        disabled={mRestore.isPending}
                        onClick={() => mRestore.mutate(s.id)}
                        className="min-h-11 border-white/15 bg-transparent text-white/80 hover:bg-white/10"
                      >
                        <Undo2 className="h-4 w-4 mr-2" aria-hidden="true" />
                        Restaurer
                      </Button>
                    </ActionTooltip>
                  ) : (
                    <ActionTooltip label="Retire la suggestion de la liste principale sans supprimer les données. Elle reste restaurable via le filtre « Suggestions écartées ».">
                      <Button
                        variant="outline"
                        aria-label={`Écarter la suggestion « ${s.subject} »`}
                        disabled={mDismiss.isPending}
                        onClick={() => setToDismiss(s)}
                        className="min-h-11 border-white/15 bg-transparent text-white/70 hover:bg-white/10"
                      >
                        Écarter
                      </Button>
                    </ActionTooltip>
                  )}
                  <ActionTooltip label="Suppression définitive de la suggestion. Préférez « Écarter » pour la masquer tout en la conservant.">
                    <Button
                      variant="outline"
                      aria-label={`Supprimer définitivement la suggestion « ${s.subject} »`}
                      onClick={() => setToDelete(s)}
                      className="min-h-11 min-w-11 border-[#f87171]/40 bg-transparent text-[#f87171] hover:bg-[#f87171]/10"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </ActionTooltip>
                </div>
              </li>
            );
          })}
        </ul>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="bg-[#1d0d3d] border-white/10 text-white max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{draft.id ? "Modifier la suggestion" : "Nouveau sujet"}</DialogTitle>
              <DialogDescription className="text-white/60">
                La suggestion sert de point de départ à un brief éditorial.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-subject" className="text-white/85">
                  Sujet proposé
                </Label>
                <Input
                  id="s-subject"
                  value={draft.subject}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-audience" className="text-white/85">
                    Public concerné
                  </Label>
                  <Input
                    id="s-audience"
                    value={draft.audience}
                    onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-pillar" className="text-white/85">
                    Pilier éditorial
                  </Label>
                  <select
                    id="s-pillar"
                    value={draft.pillar}
                    className={selectCls}
                    onChange={(e) => setDraft({ ...draft, pillar: e.target.value })}
                  >
                    <option value="" className="bg-[#1d0d3d]">
                      —
                    </option>
                    {NEWSLETTER_PILLARS.map((p) => (
                      <option key={p} value={p} className="bg-[#1d0d3d]">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-feature" className="text-white/85">
                    Fonctionnalité associée
                  </Label>
                  <select
                    id="s-feature"
                    value={draft.feature_key}
                    className={selectCls}
                    onChange={(e) => setDraft({ ...draft, feature_key: e.target.value })}
                  >
                    <option value="" className="bg-[#1d0d3d]">
                      —
                    </option>
                    {HOLISWISS_FEATURES.map((f) => (
                      <option key={f.key} value={f.key} className="bg-[#1d0d3d]">
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-priority" className="text-white/85">
                    Priorité
                  </Label>
                  <select
                    id="s-priority"
                    value={draft.priority}
                    className={selectCls}
                    onChange={(e) =>
                      setDraft({ ...draft, priority: e.target.value as Draft["priority"] })
                    }
                  >
                    {CONNECTION_PRIORITIES.map((p) => (
                      <option key={p} value={p} className="bg-[#1d0d3d]">
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-objective" className="text-white/85">
                  Objectif
                </Label>
                <Textarea
                  id="s-objective"
                  rows={2}
                  value={draft.objective}
                  onChange={(e) => setDraft({ ...draft, objective: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-rationale" className="text-white/85">
                  Justification (interne)
                </Label>
                <Textarea
                  id="s-rationale"
                  rows={2}
                  value={draft.rationale}
                  onChange={(e) => setDraft({ ...draft, rationale: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
              >
                Annuler
              </Button>
              <Button
                disabled={mSave.isPending || draft.subject.trim().length < 3}
                onClick={() => mSave.mutate(draft)}
                className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
              >
                Enregistrer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={toDismiss !== null} onOpenChange={(o) => !o && setToDismiss(null)}>
          <AlertDialogContent className="bg-[#1d0d3d] border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Écarter cette suggestion ?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/65">
                Elle ne sera plus affichée dans les suggestions prioritaires. Aucune donnée n'est
                supprimée : vous pourrez la restaurer depuis le filtre « Suggestions écartées ».
                <br />
                <span className="mt-2 block text-white/80">
                  Suggestion : « {toDismiss?.subject} »
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 bg-white/15 text-white hover:bg-white/25"
                onClick={() => toDismiss && mDismiss.mutate(toDismiss.id)}
              >
                Écarter la suggestion
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialogContent className="bg-[#1d0d3d] border-white/10 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement cet élément ?</AlertDialogTitle>
              <AlertDialogDescription className="text-white/65">
                Cette action peut être irréversible. Pour masquer l'élément tout en le conservant,
                utilisez plutôt « Écarter ».
                <br />
                <span className="mt-2 block text-white/80">
                  Type : suggestion de sujet
                  <br />
                  Nom : « {toDelete?.subject} »
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10">
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                className="min-h-11 bg-[#f87171] text-white hover:bg-[#ef4444]"
                onClick={() => toDelete && mDelete.mutate(toDelete.id)}
              >
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
