import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Image, X, ChevronDown, ChevronUp, Sparkles, Globe2, Filter, Languages, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { getAllArticlesAdmin, createArticle, updateArticle, deleteArticle, setArticleStatus, titleForLang } from "@/lib/articles.functions";
import { translateArticle, translateAllMissingArticles } from "@/lib/article-agent.functions";
import { computeSeo, computeGeo, scoreColor } from "@/lib/article-scoring";
import { hasSessionState, useSessionState } from "@/hooks/use-session-state";
import { groupedCategories } from "@/lib/article-categories";

export const Route = createFileRoute("/admin/articles")({ component: Page });

import { searchUnsplashPhotos, trackUnsplashDownload } from "@/lib/unsplash.functions";

type Lang = "fr" | "de" | "it" | "en";
type Status = "draft" | "validated" | "pending_validation" | "rejected";

function toSlug(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Unsplash picker ───────────────────────────────────────────────────────────
interface UPhoto { id: string; urls: { small: string; regular: string }; alt_description: string; user: { name: string; links: { html: string } }; links: { download_location: string } }

function UnsplashPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [query, setQuery] = useSessionState("admin.articles.unsplashQuery", "");
  const [photos, setPhotos] = useState<UPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const d = await searchUnsplashPhotos({ data: { query } });
      setPhotos((d.results ?? []) as unknown as UPhoto[]);
    } catch { toast.error("Erreur Unsplash"); }
    finally { setLoading(false); }
  }, [query]);

  const pick = (p: UPhoto) => {
    setPicked(p.id);
    if (p.links?.download_location) {
      trackUnsplashDownload({ data: { downloadLocation: p.links.download_location } }).catch(() => {});
    }
    onSelect(p.urls.regular);
  };

  return (
    <div className="space-y-3 p-3 bg-background rounded-lg border border-border/60">
      <div className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
          placeholder="méditation, reiki, plantes..." className="bg-surface border-border/60" />
        <Button type="button" variant="secondary" onClick={search} disabled={loading}>
          <Search className="h-4 w-4 mr-1" />{loading ? "..." : "Chercher"}
        </Button>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 max-h-56 overflow-y-auto">
          {photos.map(p => (
            <button key={p.id} type="button" onClick={() => pick(p)}
              className={`relative aspect-video overflow-hidden rounded-md border-2 transition-all ${picked === p.id ? "border-primary" : "border-transparent hover:border-primary/50"}`}>
              <img src={p.urls.small} alt={p.alt_description} className="w-full h-full object-cover" loading="lazy" />
              {picked === p.id && <span className="absolute top-1 right-1 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Article form ──────────────────────────────────────────────────────────────
type ArticleRow = {
  id: string; slug: string | null; status: string; lang: string;
  category: string | null; secondary_tags?: string[] | null; published_at: string | null; created_at: string | null;
  updated_at?: string | null; cover_image_url: string | null; author_id?: string | null;
  title_fr: string | null; title_de: string | null; title_it: string | null; title_en: string | null;
  excerpt_fr?: string | null; body_fr?: string | null;
  body_de?: string | null; body_it?: string | null; body_en?: string | null;
  meta_title_fr?: string | null; meta_description_fr?: string | null;
};

type FormData = {
  id?: string;
  title_fr: string; title_de: string; title_it: string; title_en: string;
  body_fr: string; body_de: string; body_it: string; body_en: string;
  excerpt_fr: string; excerpt_de: string; excerpt_it: string; excerpt_en: string;
  slug: string; cover_image_url: string; category: string; secondary_tags: string[];
  lang: Lang; status: Status;
  meta_title_fr: string; meta_description_fr: string;
};

const EMPTY: FormData = {
  title_fr: "", title_de: "", title_it: "", title_en: "",
  body_fr: "", body_de: "", body_it: "", body_en: "",
  excerpt_fr: "", excerpt_de: "", excerpt_it: "", excerpt_en: "",
  slug: "", cover_image_url: "", category: "", secondary_tags: [], lang: "fr", status: "draft",
  meta_title_fr: "", meta_description_fr: "",
};

function ArticleDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: ArticleRow | null }) {
  const qc = useQueryClient();
  const formKey = initial?.id ? `admin.articles.edit.${initial.id}` : "admin.articles.new";
  const [form, setForm] = useSessionState<FormData>(formKey, EMPTY);
  const [langTab, setLangTab] = useSessionState<Lang>(`${formKey}.langTab`, "fr");
  const [showUnsplash, setShowUnsplash] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open || hasSessionState(formKey)) return;
    setForm(initial
      ? { ...EMPTY, id: initial.id, slug: initial.slug ?? "", cover_image_url: initial.cover_image_url ?? "", category: initial.category ?? "", secondary_tags: initial.secondary_tags ?? [], lang: (initial.lang as Lang) ?? "fr", status: (initial.status as Status) ?? "draft", title_fr: initial.title_fr ?? "", title_de: initial.title_de ?? "", title_it: initial.title_it ?? "", title_en: initial.title_en ?? "" }
      : EMPTY
    );
  }, [formKey, initial, open, setForm]);

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => setForm(prev => {
    const next = { ...prev, [k]: v } as FormData;
    if (k === "title_fr" && !prev.id) next.slug = toSlug(v as string);
    return next;
  });

  const toggleTag = (slug: string) => {
    setForm(prev => {
      const tags = prev.secondary_tags ?? [];
      return { ...prev, secondary_tags: tags.includes(slug) ? tags.filter(t => t !== slug) : [...tags, slug] };
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (f: FormData) => {
      const payload = { ...f, slug: f.slug || toSlug(f.title_fr) };
      if (f.id) return updateArticle({ data: { ...payload, id: f.id } as Parameters<typeof updateArticle>[0]["data"] });
      return createArticle({ data: payload as Parameters<typeof createArticle>[0]["data"] });
    },
    onSuccess: () => {
      toast.success(form.id ? "Article mis à jour !" : "Article créé !");
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const LANG_TABS: { value: Lang; label: string }[] = [
    { value: "fr", label: "🇫🇷 FR" }, { value: "de", label: "🇩🇪 DE" },
    { value: "it", label: "🇮🇹 IT" }, { value: "en", label: "🇬🇧 EN" },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-surface border-border/60 max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(form); }} className="space-y-4 py-1">

          {/* Photo + Slug + Méta */}
          <div className="space-y-2">
            <Label>Photo de couverture</Label>
            {form.cover_image_url && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-surface-alt">
                <img src={form.cover_image_url} alt="couverture" className="w-full h-full object-cover" />
                <button type="button" onClick={() => set("cover_image_url", "")} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"><X className="h-3 w-3" /></button>
              </div>
            )}
            <div className="flex gap-2">
              <Input value={form.cover_image_url} onChange={e => set("cover_image_url", e.target.value)}
                placeholder="URL ou choisir via Unsplash ↓" className="bg-background border-border/60" />
              <Button type="button" variant="outline" onClick={() => setShowUnsplash(v => !v)} className="shrink-0">
                <Image className="h-4 w-4 mr-1" />Unsplash
              </Button>
            </div>
            {showUnsplash && <UnsplashPicker onSelect={url => { set("cover_image_url", url); setShowUnsplash(false); }} />}
          </div>

          {/* Contenu multilingue */}
          <Tabs value={langTab} onValueChange={(v) => setLangTab(v as Lang)}>
            <TabsList className="bg-background border border-border/60">
              {LANG_TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
            </TabsList>
            {LANG_TABS.map(({ value: l }) => (
              <TabsContent key={l} value={l} className="space-y-3 mt-3">
                <div className="space-y-1">
                  <Label>Titre {l === "fr" && <span className="text-destructive">*</span>}</Label>
                  <Input value={form[`title_${l}` as keyof FormData] as string}
                    onChange={e => set(`title_${l}` as keyof FormData, e.target.value)}
                    required={l === "fr"} placeholder={l === "fr" ? "Titre principal..." : "Optionnel"}
                    className="bg-background border-border/60" />
                </div>
                <div className="space-y-1">
                  <Label>Extrait <span className="text-muted-foreground text-xs">(affiché dans les cartes)</span></Label>
                  <Textarea value={form[`excerpt_${l}` as keyof FormData] as string}
                    onChange={e => set(`excerpt_${l}` as keyof FormData, e.target.value)}
                    rows={2} placeholder="120-150 caractères..." className="bg-background border-border/60 resize-none" />
                </div>
                <div className="space-y-1">
                  <Label>Contenu Markdown {l === "fr" && <span className="text-destructive">*</span>}</Label>
                  <Textarea value={form[`body_${l}` as keyof FormData] as string}
                    onChange={e => set(`body_${l}` as keyof FormData, e.target.value)}
                    required={l === "fr"} rows={12} placeholder={"## Introduction\n\nVotre contenu..."}
                    className="bg-background border-border/60 font-mono text-sm resize-y" />
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Paramètres */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => set("slug", e.target.value)} className="bg-background border-border/60 font-mono text-sm" placeholder="auto" />
            </div>
            <div className="space-y-1">
              <Label>Catégorie</Label>
              <Select value={form.category} onValueChange={v => set("category", v)}>
                <SelectTrigger className="bg-background border-border/60"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent className="bg-surface border-border/60 max-h-80">
                  {groupedCategories("fr").map(group => (
                    <div key={group.key}>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {group.label}
                      </div>
                      {group.items.map(c => (
                        <SelectItem key={c.slug} value={c.slug}>{c.name_fr}</SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Langue principale</Label>
              <Select value={form.lang} onValueChange={v => set("lang", v as Lang)}>
                <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-surface border-border/60">
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => set("status", v as Status)}>
                <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-surface border-border/60">
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="validated">Publié ✓</SelectItem>
                  <SelectItem value="pending_validation">En validation</SelectItem>
                  <SelectItem value="rejected">Rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags secondaires (multi-sélection) */}
          <div className="space-y-2">
            <Label>
              Tags secondaires <span className="text-muted-foreground text-xs">(facultatif, plusieurs possibles)</span>
            </Label>
            <div className="rounded-lg border border-border/60 bg-background p-3 max-h-56 overflow-y-auto space-y-3">
              {groupedCategories("fr").map(group => (
                <div key={group.key}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.filter(c => c.slug !== form.category).map(c => {
                      const active = (form.secondary_tags ?? []).includes(c.slug);
                      return (
                        <button
                          key={c.slug}
                          type="button"
                          onClick={() => toggleTag(c.slug)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            active
                              ? "bg-primary/20 border-primary/60 text-primary"
                              : "bg-surface border-border/60 text-muted-foreground hover:text-foreground"
                          }`}
                          aria-pressed={active}
                        >
                          {active ? "✓ " : ""}{c.name_fr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement..." : form.status === "validated" ? "✓ Publier" : "Sauvegarder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Status meta ───────────────────────────────────────────────────────────────
type StatusFilter = "all" | "validated" | "pending_validation" | "rejected" | "draft";

const STATUS_META: Record<Exclude<StatusFilter, "all">, { label: string; emoji: string; cls: string; chip: string }> = {
  validated:          { label: "Publiés",    emoji: "✅", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",     chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  pending_validation: { label: "En attente", emoji: "⏳", cls: "border-orange-500/40 bg-orange-500/10 text-orange-300",        chip: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  rejected:           { label: "Refusés",    emoji: "❌", cls: "border-red-500/40 bg-red-500/10 text-red-300",                  chip: "bg-red-500/15 text-red-300 border-red-500/30" },
  draft:              { label: "Brouillons", emoji: "📝", cls: "border-slate-500/40 bg-slate-500/10 text-slate-300",            chip: "bg-slate-500/15 text-slate-300 border-slate-500/30" },
};

type ScoredArticle = ArticleRow & {
  _seo: ReturnType<typeof computeSeo>;
  _geo: ReturnType<typeof computeGeo>;
  _title: string;
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status as keyof typeof STATUS_META];
  if (!meta) return <Badge variant="outline">{status}</Badge>;
  return <Badge variant="outline" className={meta.chip}>{meta.emoji} {meta.label.replace(/s$/, "")}</Badge>;
}

function ScorePill({ value, kind }: { value: number; kind: "seo" | "geo" }) {
  const c = scoreColor(value);
  const label = kind === "seo" ? "SEO" : "GEO";
  const Icon = kind === "seo" ? Sparkles : Globe2;
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${c.bg} ${c.text} ${c.border}`} title={c.label}>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      <span className="tabular-nums">{value}/100</span>
    </div>
  );
}

function ArticleCard({
  a, onEdit, onDelete, onTogglePublish, onImprove, onTranslate, translating,
}: {
  a: ScoredArticle;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onImprove: () => void;
  onTranslate: () => void;
  translating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const isPublished = a.status === "validated";
  const missingLangs = (["de","it","en"] as const).filter(l => !(a as any)[`body_${l}`]);

  return (
    <Card className="bg-surface border-border/60 overflow-hidden">
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start gap-4">
          {a.cover_image_url
            ? <img src={a.cover_image_url} alt="" className="w-24 h-20 object-cover rounded-lg shrink-0" loading="lazy" />
            : <div className="w-24 h-20 bg-background rounded-lg shrink-0 flex items-center justify-center text-muted-foreground border border-border/60"><Image className="h-6 w-6" /></div>
          }
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={a.status} />
              <Badge variant="outline" className="border-border/60 text-xs uppercase tracking-wide">{a.lang}</Badge>
              {a.category && <Badge variant="secondary" className="text-xs">{a.category}</Badge>}
              <ScorePill value={a._seo.score} kind="seo" />
              <ScorePill value={a._geo.score} kind="geo" />
              {missingLangs.length > 0 && (
                <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-xs">
                  Manque : {missingLangs.join(", ").toUpperCase()}
                </Badge>
              )}
            </div>
            <h3 className="text-lg font-bold text-foreground leading-tight truncate">
              {a._title || <span className="italic text-muted-foreground">Sans titre</span>}
            </h3>
            <p className="text-xs text-muted-foreground">
              {a.author_id ? <>Auteur <span className="font-mono">{a.author_id.slice(0, 8)}</span> · </> : null}
              {a.published_at
                ? <>Publié le {new Date(a.published_at).toLocaleDateString("fr-CH")}</>
                : <>Créé le {a.created_at ? new Date(a.created_at).toLocaleDateString("fr-CH") : "—"}</>}
              {a.slug ? <> · <span className="font-mono">/{a.slug}</span></> : null}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" title={isPublished ? "Dépublier" : "Publier"} onClick={onTogglePublish}>
                {isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" title="Éditer" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" title="Supprimer" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={onImprove}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />Améliorer le SEO
            </Button>
            {missingLangs.length > 0 && (
              <Button size="sm" variant="outline"
                className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                onClick={onTranslate} disabled={translating}>
                {translating
                  ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  : <Languages className="h-3.5 w-3.5 mr-1" />}
                Traduire ({missingLangs.length})
              </Button>
            )}
          </div>
        </div>

        {/* Expandable SEO checklist */}
        <button type="button" onClick={() => setOpen(v => !v)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Checklist SEO ({a._seo.checklist.filter(c => c.ok).length}/{a._seo.checklist.length})
        </button>
        {open && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-1.5 rounded-lg border border-border/40 bg-background/40 p-3">
            {a._seo.checklist.map(item => (
              <div key={item.key} className="flex items-start gap-2 text-xs">
                <span className={item.ok ? "text-emerald-400" : "text-red-400"}>{item.ok ? "✓" : "✗"}</span>
                <div className="min-w-0">
                  <div className={item.ok ? "text-foreground" : "text-foreground/80"}>{item.label}</div>
                  {item.hint && <div className="text-muted-foreground">{item.hint}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Page() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useSessionState("admin.articles.dialogOpen", false);
  const [editing, setEditing] = useSessionState<ArticleRow | null>("admin.articles.editing", null);

  // Filters
  const [statusFilter, setStatusFilter] = useSessionState<StatusFilter>("admin.articles.f.status", "all");
  const [langFilter, setLangFilter] = useSessionState<string>("admin.articles.f.lang", "all");
  const [sortBy, setSortBy] = useSessionState<string>("admin.articles.f.sort", "date_desc");
  const [search, setSearch] = useSessionState<string>("admin.articles.f.search", "");
  const [seoMin, setSeoMin] = useSessionState<number>("admin.articles.f.seoMin", 0);
  const [geoMin, setGeoMin] = useSessionState<number>("admin.articles.f.geoMin", 0);

  // Side panel
  const [improving, setImproving] = useState<ScoredArticle | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: () => getAllArticlesAdmin(),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle({ data: { id } }),
    onSuccess: () => { toast.success("Article supprimé."); qc.invalidateQueries({ queryKey: ["admin-articles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (p: { id: string; status: "draft" | "validated" | "pending_validation" | "rejected" }) =>
      setArticleStatus({ data: p }),
    onSuccess: () => { toast.success("Statut mis à jour."); qc.invalidateQueries({ queryKey: ["admin-articles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const translateMutation = useMutation({
    mutationFn: (id: string) => translateArticle({ data: { id } }),
    onSuccess: (r) => {
      const langs = (r as any)?.updated ?? [];
      toast.success(langs.length ? `Traduit en ${langs.join(", ").toUpperCase()}.` : "Aucune langue à traduire.");
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const translateAllMutation = useMutation({
    mutationFn: () => translateAllMissingArticles(),
    onSuccess: (r: any) => {
      toast.success(`Traductions : ${r.success}/${r.total} OK${r.failed ? `, ${r.failed} échouées` : ""}.`);
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rawArticles = (data?.articles ?? []) as unknown as ArticleRow[];

  const scored: ScoredArticle[] = useMemo(() => rawArticles.map(a => ({
    ...a,
    _seo: computeSeo(a),
    _geo: computeGeo(a),
    _title: titleForLang(a as Record<string, unknown>, (a.lang as Lang) ?? "fr"),
  })), [rawArticles]);

  const counts = useMemo(() => ({
    all: scored.length,
    validated: scored.filter(a => a.status === "validated").length,
    pending_validation: scored.filter(a => a.status === "pending_validation").length,
    rejected: scored.filter(a => a.status === "rejected").length,
    draft: scored.filter(a => a.status === "draft").length,
  }), [scored]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = scored.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (langFilter !== "all" && a.lang !== langFilter) return false;
      if (a._seo.score < seoMin) return false;
      if (a._geo.score < geoMin) return false;
      if (q && !(a._title.toLowerCase().includes(q) || (a.slug ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
    const ts = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);
    list.sort((a, b) => {
      switch (sortBy) {
        case "date_asc":  return ts(a.created_at) - ts(b.created_at);
        case "seo_asc":   return a._seo.score - b._seo.score;
        case "seo_desc":  return b._seo.score - a._seo.score;
        case "geo_asc":   return a._geo.score - b._geo.score;
        case "geo_desc":  return b._geo.score - a._geo.score;
        case "status":    return a.status.localeCompare(b.status);
        case "date_desc":
        default:          return ts(b.created_at) - ts(a.created_at);
      }
    });
    return list;
  }, [scored, statusFilter, langFilter, seoMin, geoMin, sortBy, search]);

  return (
    <div className="p-6 md:p-10 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Articles de blog</h1>
          <p className="text-muted-foreground mt-1">
            {counts.all} article{counts.all !== 1 ? "s" : ""} au total
            {filtered.length !== counts.all && <> · {filtered.length} affiché{filtered.length !== 1 ? "s" : ""}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"
            className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
            onClick={() => translateAllMutation.mutate()}
            disabled={translateAllMutation.isPending}>
            {translateAllMutation.isPending
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Languages className="h-4 w-4 mr-2" />}
            Traduire les articles manquants
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Nouvel article
          </Button>
        </div>
      </div>

      {/* Status summary badges */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <button onClick={() => setStatusFilter("all")}
          className={`rounded-xl border p-3 text-left transition-all ${statusFilter === "all" ? "border-primary/60 bg-primary/10 ring-1 ring-primary/40" : "border-border/60 bg-surface hover:bg-surface/70"}`}>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">📚 Total</div>
          <div className="text-2xl font-bold text-foreground mt-1">{counts.all}</div>
        </button>
        {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map(k => {
          const m = STATUS_META[k];
          const active = statusFilter === k;
          return (
            <button key={k} onClick={() => setStatusFilter(active ? "all" : k)}
              className={`rounded-xl border p-3 text-left transition-all ${active ? `${m.cls} ring-1 ring-current/30` : "border-border/60 bg-surface hover:bg-surface/70"}`}>
              <div className={`text-xs uppercase tracking-wider ${active ? "" : "text-muted-foreground"}`}>{m.emoji} {m.label}</div>
              <div className="text-2xl font-bold mt-1">{counts[k]}</div>
            </button>
          );
        })}
      </div>

      {/* Filters bar */}
      <Card className="bg-surface border-border/60">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-4 space-y-1">
            <Label className="text-xs text-muted-foreground"><Search className="inline h-3 w-3 mr-1" />Recherche</Label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Titre ou slug…" className="bg-background border-border/60" />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">Langue</Label>
            <Select value={langFilter} onValueChange={setLangFilter}>
              <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-surface border-border/60">
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="fr">🇫🇷 FR</SelectItem>
                <SelectItem value="de">🇩🇪 DE</SelectItem>
                <SelectItem value="it">🇮🇹 IT</SelectItem>
                <SelectItem value="en">🇬🇧 EN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">SEO min</Label>
            <Select value={String(seoMin)} onValueChange={v => setSeoMin(Number(v))}>
              <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-surface border-border/60">
                <SelectItem value="0">Tous</SelectItem>
                <SelectItem value="50">≥ 50</SelectItem>
                <SelectItem value="80">≥ 80</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">GEO min</Label>
            <Select value={String(geoMin)} onValueChange={v => setGeoMin(Number(v))}>
              <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-surface border-border/60">
                <SelectItem value="0">Tous</SelectItem>
                <SelectItem value="50">≥ 50</SelectItem>
                <SelectItem value="80">≥ 80</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground"><Filter className="inline h-3 w-3 mr-1" />Tri</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-surface border-border/60">
                <SelectItem value="date_desc">Date ↓</SelectItem>
                <SelectItem value="date_asc">Date ↑</SelectItem>
                <SelectItem value="seo_asc">SEO faible d'abord</SelectItem>
                <SelectItem value="seo_desc">SEO élevé d'abord</SelectItem>
                <SelectItem value="geo_asc">GEO faible d'abord</SelectItem>
                <SelectItem value="geo_desc">GEO élevé d'abord</SelectItem>
                <SelectItem value="status">Statut</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-border/40" />

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}

      {!isLoading && error && (
        <Card className="bg-surface border-destructive/40">
          <CardContent className="p-6 text-center text-destructive">
            <p className="font-semibold">Erreur de chargement</p>
            <p className="text-sm mt-1 text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <Card className="bg-surface border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground">
            {counts.all === 0 ? "Aucun article. Créez le premier !" : "Aucun article ne correspond aux filtres."}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {filtered.map(a => (
          <ArticleCard
            key={a.id}
            a={a}
            onEdit={() => { setEditing(a); setDialogOpen(true); }}
            onDelete={() => { if (confirm(`Supprimer « ${a._title || a.slug} » ?`)) deleteMutation.mutate(a.id); }}
            onTogglePublish={() => statusMutation.mutate({ id: a.id, status: a.status === "validated" ? "draft" : "validated" })}
            onImprove={() => setImproving(a)}
            onTranslate={() => translateMutation.mutate(a.id)}
            translating={translateMutation.isPending && translateMutation.variables === a.id}
          />
        ))}
      </div>

      <ArticleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />

      {/* Side panel — SEO recommendations */}
      <Sheet open={!!improving} onOpenChange={v => !v && setImproving(null)}>
        <SheetContent className="bg-surface border-border/60 w-full sm:max-w-lg overflow-y-auto">
          {improving && (
            <>
              <SheetHeader>
                <SheetTitle className="text-foreground flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Améliorer le SEO
                </SheetTitle>
                <SheetDescription className="truncate">{improving._title || improving.slug}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Score SEO</span>
                    <span className="font-bold text-foreground">{improving._seo.score}/100</span>
                  </div>
                  <Progress value={improving._seo.score} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Score GEO (pertinence Suisse)</span>
                    <span className="font-bold text-foreground">{improving._geo.score}/100</span>
                  </div>
                  <Progress value={improving._geo.score} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Villes : {improving._geo.cities.length || "—"} · Cantons : {improving._geo.cantons.length || "—"} · Mots-clés : {improving._geo.keywords.length || "—"}
                  </p>
                </div>

                <Separator className="bg-border/40" />

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Recommandations prioritaires</h4>
                  {improving._seo.checklist.filter(c => !c.ok).length === 0 ? (
                    <p className="text-sm text-emerald-300">🎉 Tous les critères SEO sont validés.</p>
                  ) : (
                    <ul className="space-y-2">
                      {improving._seo.checklist.filter(c => !c.ok).map(c => (
                        <li key={c.key} className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                          <div className="text-sm font-medium text-foreground">❌ {c.label}</div>
                          {c.hint && <div className="text-xs text-muted-foreground mt-0.5">{c.hint}</div>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {improving._geo.score < 50 && (
                  <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-sm">
                    <div className="font-medium text-foreground">🌍 Renforcer le GEO</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mentionnez explicitement des villes (Lausanne, Genève, Zurich…), cantons (Vaud, Valais…) et le contexte suisse (« Suisse romande », « Helvétique »).
                    </p>
                  </div>
                )}

                <Button className="w-full bg-primary hover:bg-primary/90" onClick={() => { setEditing(improving); setDialogOpen(true); setImproving(null); }}>
                  <Pencil className="h-4 w-4 mr-2" />Éditer l'article
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
