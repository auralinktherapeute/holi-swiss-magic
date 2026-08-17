import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Mail, Plus, Archive, PencilLine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NewsletterSuggestions } from "@/components/admin/NewsletterSuggestions";
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
import {
  listNewsletterIssues,
  createNewsletterIssue,
  updateNewsletterIssue,
  setNewsletterIssueStatus,
} from "@/lib/newsletter.functions";
import {
  NEWSLETTER_STATUSES,
  NEWSLETTER_STATUS_LABELS,
  NEWSLETTER_LANGS,
  NEWSLETTER_LANG_LABELS,
  NEWSLETTER_PILLARS,
  NEWSLETTER_TONES,
  type NewsletterIssue,
  type NewsletterStatus,
} from "@/lib/newsletter.shared";

export const Route = createFileRoute("/admin/newsletter/")({ component: Page });

const STATUS_COLORS: Record<NewsletterStatus, string> = {
  idee: "bg-white/10 text-white/70",
  brouillon: "bg-[#5cc8fa]/15 text-[#5cc8fa]",
  en_revision: "bg-[#fbbf24]/15 text-[#fbbf24]",
  approuvee: "bg-[#4ade80]/15 text-[#4ade80]",
  programmee: "bg-[#b86ef9]/15 text-[#b86ef9]",
  envoyee: "bg-white/15 text-white",
  echec: "bg-[#f87171]/15 text-[#f87171]",
  archivee: "bg-white/5 text-white/40",
};

type FormState = {
  id?: string;
  title: string;
  problem: string;
  objective: string;
  audience: string;
  pillar: string;
  tone: string;
  feature_highlight: string;
  cta: string;
  lang: string;
  target_date: string;
  internal_notes: string;
  status: NewsletterStatus;
};

const EMPTY: FormState = {
  title: "",
  problem: "",
  objective: "",
  audience: "Thérapeutes inscrits sur Holiswiss",
  pillar: "",
  tone: "",
  feature_highlight: "",
  cta: "",
  lang: "fr",
  target_date: "",
  internal_notes: "",
  status: "brouillon",
};

const inputCls =
  "bg-white/5 border-white/10 text-white placeholder:text-white/35 focus-visible:ring-[#b86ef9]";
const selectCls =
  "h-11 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]";

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listNewsletterIssues);
  const create = useServerFn(createNewsletterIssue);
  const update = useServerFn(updateNewsletterIssue);
  const setStatus = useServerFn(setNewsletterIssueStatus);
  const [statusFilter, setStatusFilter] = useState<"all" | NewsletterStatus>("all");

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [toArchive, setToArchive] = useState<NewsletterIssue | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-newsletter-issues"],
    queryFn: () => list(),
  });
  const allRows: NewsletterIssue[] = (data?.rows ?? []) as NewsletterIssue[];
  const rows = statusFilter === "all" ? allRows : allRows.filter((r) => r.status === statusFilter);

  const archive = useMutation({
    mutationFn: (id: string) => setStatus({ data: { id, status: "archivee" as NewsletterStatus } }),
    onSuccess: () => {
      toast.success("Newsletter archivée — aucun contenu supprimé.");
      setToArchive(null);
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issues"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Archivage impossible."),
  });

  const save = useMutation({
    mutationFn: async (payload: FormState) => {
      const body = {
        title: payload.title,
        problem: payload.problem,
        objective: payload.objective,
        audience: payload.audience,
        pillar: payload.pillar,
        tone: payload.tone,
        feature_highlight: payload.feature_highlight,
        cta: payload.cta,
        lang: payload.lang,
        target_date: payload.target_date,
        internal_notes: payload.internal_notes,
        status: payload.status,
      };
      return payload.id ? update({ data: { ...body, id: payload.id } }) : create({ data: body });
    },
    onSuccess: () => {
      toast.success("Newsletter enregistrée en brouillon.");
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin-newsletter-issues"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const openNew = () => {
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (row: NewsletterIssue) => {
    setForm({
      id: row.id,
      title: row.title,
      problem: row.problem ?? "",
      objective: row.objective ?? "",
      audience: row.audience ?? "",
      pillar: row.pillar ?? "",
      tone: row.tone ?? "",
      feature_highlight: row.feature_highlight ?? "",
      cta: row.cta ?? "",
      lang: row.lang ?? "fr",
      target_date: row.target_date ?? "",
      internal_notes: row.internal_notes ?? "",
      status: row.status,
    });
    setOpen(true);
  };

  return (
    <div className="p-6 md:p-10 space-y-6 text-white">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-7 w-7 text-[#b86ef9]" aria-hidden="true" />
            Newsletter thérapeutes
          </h1>
          <p className="text-white/60 mt-1">
            « La Lettre Holiswiss » — briefs éditoriaux. Aucun envoi n'est déclenché depuis cette
            page.
          </p>
        </div>
        <Button onClick={openNew} className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white">
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Nouvelle newsletter
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
        <Button
          size="sm"
          variant={statusFilter === "all" ? "default" : "outline"}
          onClick={() => setStatusFilter("all")}
          className={
            statusFilter === "all"
              ? "min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
              : "min-h-11 border-white/15 bg-transparent text-white/80 hover:bg-white/10"
          }
        >
          Tous ({allRows.length})
        </Button>
        {NEWSLETTER_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className={
              statusFilter === s
                ? "min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
                : "min-h-11 border-white/15 bg-transparent text-white/80 hover:bg-white/10"
            }
          >
            {NEWSLETTER_STATUS_LABELS[s]} ({allRows.filter((r) => r.status === s).length})
          </Button>
        ))}
      </div>

      <div className="mb-6">
        <NewsletterSuggestions />
      </div>

      <div className="grid gap-3">
        {isLoading && (
          <Card className="bg-[#1d0d3d] border-white/10">
            <CardContent className="p-6 text-white/60">Chargement…</CardContent>
          </Card>
        )}
        {error && (
          <Card className="bg-[#1d0d3d] border-[#f87171]/40">
            <CardContent className="p-6 text-[#f87171]">
              Impossible de charger les newsletters.
            </CardContent>
          </Card>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <Card className="bg-[#1d0d3d] border-white/10">
            <CardContent className="p-8 text-center text-white/60">
              Aucune newsletter pour le moment. Commencez par une idée de sujet.
            </CardContent>
          </Card>
        )}
        {rows.map((row) => (
          <Card key={row.id} className="bg-[#1d0d3d] border-white/10">
            <CardContent className="p-5 flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-white">{row.title}</h2>
                  <Badge className={`${STATUS_COLORS[row.status]} border-0`}>
                    {NEWSLETTER_STATUS_LABELS[row.status]}
                  </Badge>
                  <Badge className="bg-white/5 text-white/60 border-0">
                    {NEWSLETTER_LANG_LABELS[
                      (row.lang as keyof typeof NEWSLETTER_LANG_LABELS) ?? "fr"
                    ] ?? row.lang}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-white/55">
                  {[
                    row.pillar,
                    row.audience,
                    row.target_date ? `Souhaitée le ${row.target_date}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Brief à compléter"}
                </p>
                <p className="mt-1 text-xs text-white/40">
                  Modifiée le {new Date(row.updated_at).toLocaleString("fr-CH")}
                  {row.created_by_email ? ` · ${row.created_by_email}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => openEdit(row)}
                  title="Modifier le brief éditorial (titre, objectif, angle). Aucun envoi."
                  className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
                >
                  <PencilLine className="h-4 w-4 mr-2" aria-hidden="true" />
                  Modifier le brief
                </Button>
                <Button
                  asChild
                  title="Ouvrir la rédaction de l'email, l'aperçu et l'onglet Envoi"
                  className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
                >
                  <Link to="/admin/newsletter/$id" params={{ id: row.id }}>
                    Ouvrir l'éditeur
                  </Link>
                </Button>
                {row.status !== "archivee" && (
                  <Button
                    variant="outline"
                    aria-label={`Archiver ${row.title}`}
                    title="Archiver : sort la newsletter du flux de travail, réversible"
                    disabled={archive.isPending}
                    onClick={() => setToArchive(row)}
                    className="min-h-11 border-white/15 bg-transparent text-white/70 hover:bg-white/10"
                  >
                    <Archive className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1d0d3d] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier le brief" : "Nouvelle newsletter"}</DialogTitle>
            <DialogDescription className="text-white/55">
              Brief éditorial. Le contenu sera rédigé plus tard : rien n'est envoyé ni publié ici.
            </DialogDescription>
          </DialogHeader>

          <form
            id="newsletter-brief-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="nl-title">Titre ou idée *</Label>
              <Input
                id="nl-title"
                required
                minLength={3}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={inputCls}
                placeholder="Ex. Remplir son agenda sans démarcher"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-problem">Problématique</Label>
              <Textarea
                id="nl-problem"
                rows={3}
                value={form.problem}
                onChange={(e) => set("problem", e.target.value)}
                className={inputCls}
                placeholder="Quel problème concret vit le thérapeute ?"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-objective">Objectif</Label>
              <Textarea
                id="nl-objective"
                rows={2}
                value={form.objective}
                onChange={(e) => set("objective", e.target.value)}
                className={inputCls}
                placeholder="Ce que le lecteur doit comprendre ou faire après lecture"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nl-audience">Public cible</Label>
                <Input
                  id="nl-audience"
                  value={form.audience}
                  onChange={(e) => set("audience", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-pillar">Pilier éditorial</Label>
                <select
                  id="nl-pillar"
                  value={form.pillar}
                  onChange={(e) => set("pillar", e.target.value)}
                  className={selectCls}
                >
                  <option value="">—</option>
                  {NEWSLETTER_PILLARS.map((p) => (
                    <option key={p} value={p} className="bg-[#1d0d3d]">
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-tone">Ton</Label>
                <select
                  id="nl-tone"
                  value={form.tone}
                  onChange={(e) => set("tone", e.target.value)}
                  className={selectCls}
                >
                  <option value="">—</option>
                  {NEWSLETTER_TONES.map((t) => (
                    <option key={t} value={t} className="bg-[#1d0d3d]">
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-feature">Fonctionnalité Holiswiss à mettre en avant</Label>
                <Input
                  id="nl-feature"
                  value={form.feature_highlight}
                  onChange={(e) => set("feature_highlight", e.target.value)}
                  className={inputCls}
                  placeholder="Ex. Agenda, CRM, facturation…"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-cta">Appel à l'action</Label>
                <Input
                  id="nl-cta"
                  value={form.cta}
                  onChange={(e) => set("cta", e.target.value)}
                  className={inputCls}
                  placeholder="Ex. Activer son agenda en ligne"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-lang">Langue</Label>
                <select
                  id="nl-lang"
                  value={form.lang}
                  onChange={(e) => set("lang", e.target.value)}
                  className={selectCls}
                >
                  {NEWSLETTER_LANGS.map((l) => (
                    <option key={l} value={l} className="bg-[#1d0d3d]">
                      {NEWSLETTER_LANG_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-date">Date souhaitée</Label>
                <Input
                  id="nl-date"
                  type="date"
                  value={form.target_date}
                  onChange={(e) => set("target_date", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nl-status">Statut</Label>
                <select
                  id="nl-status"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value as NewsletterStatus)}
                  className={selectCls}
                >
                  {NEWSLETTER_STATUSES.map((s) => (
                    <option key={s} value={s} className="bg-[#1d0d3d]">
                      {NEWSLETTER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nl-notes">Notes internes</Label>
              <Textarea
                id="nl-notes"
                rows={3}
                value={form.internal_notes}
                onChange={(e) => set("internal_notes", e.target.value)}
                className={inputCls}
                placeholder="Sources, angles à éviter, rappels…"
              />
            </div>
          </form>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="min-h-11 border-white/15 bg-transparent text-white hover:bg-white/10"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              form="newsletter-brief-form"
              disabled={save.isPending}
              className="min-h-11 bg-[#b86ef9] hover:bg-[#a355f0] text-white"
            >
              {save.isPending ? "Enregistrement…" : "Enregistrer en brouillon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
