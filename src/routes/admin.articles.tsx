import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
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
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Image, X } from "lucide-react";
import { getAllArticlesAdmin, createArticle, updateArticle, deleteArticle, titleForLang } from "@/lib/articles.functions";

export const Route = createFileRoute("/admin/articles")({ component: Page });

const CATEGORIES = [
  "reflexologie", "reiki", "naturopathie", "sophrologie", "acupuncture",
  "osteopathie", "yoga", "hypnose", "aromatherapie", "magnetisme",
  "shiatsu", "meditation", "coaching", "ayurveda",
];

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY ?? "";

type Lang = "fr" | "de" | "it" | "en";
type Status = "draft" | "validated" | "pending_validation" | "rejected";

function toSlug(str: string) {
  return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Unsplash picker ───────────────────────────────────────────────────────────
interface UPhoto { id: string; urls: { small: string; regular: string }; alt_description: string; user: { name: string; links: { html: string } }; links: { download_location: string } }

function UnsplashPicker({ onSelect }: { onSelect: (url: string) => void }) {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<UPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    if (!UNSPLASH_KEY) { toast.error("VITE_UNSPLASH_ACCESS_KEY manquant dans .env"); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
      );
      const d = await res.json();
      setPhotos(d.results ?? []);
    } catch { toast.error("Erreur Unsplash"); }
    finally { setLoading(false); }
  }, [query]);

  const pick = (p: UPhoto) => {
    setPicked(p.id);
    if (UNSPLASH_KEY) fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }).catch(() => {});
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
type ArticleRow = { id: string; slug: string | null; status: string; lang: string; category: string | null; published_at: string | null; created_at: string | null; cover_image_url: string | null; title_fr: string | null; title_de: string | null; title_it: string | null; title_en: string | null };

type FormData = {
  id?: string;
  title_fr: string; title_de: string; title_it: string; title_en: string;
  body_fr: string; body_de: string; body_it: string; body_en: string;
  excerpt_fr: string; excerpt_de: string; excerpt_it: string; excerpt_en: string;
  slug: string; cover_image_url: string; category: string;
  lang: Lang; status: Status;
  meta_title_fr: string; meta_description_fr: string;
};

const EMPTY: FormData = {
  title_fr: "", title_de: "", title_it: "", title_en: "",
  body_fr: "", body_de: "", body_it: "", body_en: "",
  excerpt_fr: "", excerpt_de: "", excerpt_it: "", excerpt_en: "",
  slug: "", cover_image_url: "", category: "", lang: "fr", status: "draft",
  meta_title_fr: "", meta_description_fr: "",
};

function ArticleDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: ArticleRow | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [showUnsplash, setShowUnsplash] = useState(false);

  // Reset on open
  useState(() => {
    if (open) setForm(initial
      ? { ...EMPTY, id: initial.id, slug: initial.slug ?? "", cover_image_url: initial.cover_image_url ?? "", category: initial.category ?? "", lang: (initial.lang as Lang) ?? "fr", status: (initial.status as Status) ?? "draft", title_fr: initial.title_fr ?? "", title_de: initial.title_de ?? "", title_it: initial.title_it ?? "", title_en: initial.title_en ?? "" }
      : EMPTY
    );
  });

  const set = (k: keyof FormData, v: string) => setForm(prev => {
    const next = { ...prev, [k]: v };
    if (k === "title_fr" && !prev.id) next.slug = toSlug(v);
    return next;
  });

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
          <Tabs defaultValue="fr">
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
                <SelectContent className="bg-surface border-border/60">
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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

// ── Page ──────────────────────────────────────────────────────────────────────
function Page() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ArticleRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-articles"],
    queryFn: () => getAllArticlesAdmin(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteArticle({ data: { id } }),
    onSuccess: () => { toast.success("Article supprimé."); qc.invalidateQueries({ queryKey: ["admin-articles"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const articles = (data?.articles ?? []) as ArticleRow[];

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      validated: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      draft: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
      pending_validation: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      rejected: "bg-destructive/15 text-destructive border-destructive/30",
    };
    const label: Record<string, string> = { validated: "Publié", draft: "Brouillon", pending_validation: "En validation", rejected: "Rejeté" };
    return <Badge variant="outline" className={map[status] ?? ""}>{label[status] ?? status}</Badge>;
  };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Articles de blog</h1>
          <p className="text-muted-foreground mt-1">{articles.length} article{articles.length !== 1 ? "s" : ""}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Nouvel article
        </Button>
      </div>

      <Separator className="bg-border/40" />

      {isLoading && <p className="text-muted-foreground">Chargement...</p>}

      {!isLoading && articles.length === 0 && (
        <Card className="bg-surface border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground">Aucun article. Créez le premier !</CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {articles.map(a => (
          <Card key={a.id} className="bg-surface border-border/60">
            <CardContent className="p-4 flex items-center gap-4">
              {a.cover_image_url
                ? <img src={a.cover_image_url} alt="" className="w-20 h-14 object-cover rounded-md shrink-0" />
                : <div className="w-20 h-14 bg-surface-alt rounded-md shrink-0 flex items-center justify-center text-muted-foreground"><Image className="h-5 w-5" /></div>
              }
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {statusBadge(a.status)}
                  {a.category && <Badge variant="secondary" className="text-xs">{a.category}</Badge>}
                  <span className="text-xs text-muted-foreground uppercase">{a.lang}</span>
                </div>
                <p className="font-semibold text-foreground truncate">
                  {titleForLang(a as Record<string, unknown>, a.lang as Lang) || <span className="text-muted-foreground italic">Sans titre</span>}
                </p>
                <p className="text-xs text-muted-foreground font-mono">{a.slug}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Supprimer cet article ?`)) deleteMutation.mutate(a.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ArticleDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initial={editing} />
    </div>
  );
}
