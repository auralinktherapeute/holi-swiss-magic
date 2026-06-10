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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Image, X } from "lucide-react";
import { getAllArticlesAdmin, createArticle, updateArticle, deleteArticle } from "@/lib/articles.functions";

export const Route = createFileRoute("/admin/articles")({ component: Page });

const CATEGORIES = [
  "reflexologie", "reiki", "naturopathie", "sophrologie", "acupuncture",
  "osteopathie", "yoga", "hypnose", "aromatherapie", "magnetisme",
  "shiatsu", "meditation", "coaching", "ayurveda",
];

const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY ?? "";

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
    if (!query.trim() || !UNSPLASH_KEY) {
      if (!UNSPLASH_KEY) toast.error("VITE_UNSPLASH_ACCESS_KEY manquant dans .env");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=12&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }
      );
      const d = await res.json();
      setPhotos(d.results ?? []);
    } catch {
      toast.error("Erreur Unsplash");
    } finally {
      setLoading(false);
    }
  }, [query]);

  const pick = (p: UPhoto) => {
    setPicked(p.id);
    // Unsplash API guidelines: trigger download endpoint
    if (UNSPLASH_KEY) fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } }).catch(() => {});
    onSelect(p.urls.regular);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
          placeholder="méditation, reiki, plantes..." className="bg-surface border-border/60" />
        <Button type="button" variant="secondary" onClick={search} disabled={loading}>
          <Search className="h-4 w-4 mr-1" />{loading ? "..." : "Chercher"}
        </Button>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
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
type ArticleRow = { id: string; title: string; slug: string; status: string; lang: string; category: string | null; published_at: string | null; created_at: string; cover_image_url: string | null };
type FormData = { id?: string; title: string; slug: string; excerpt: string; content: string; cover_image_url: string; category: string; author: string; lang: "fr" | "de" | "en" | "it"; status: "draft" | "published" | "archived" };

const EMPTY: FormData = { title: "", slug: "", excerpt: "", content: "", cover_image_url: "", category: "", author: "", lang: "fr", status: "draft" };

function ArticleDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: ArticleRow | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormData>(EMPTY);
  const [showUnsplash, setShowUnsplash] = useState(false);

  // Reset form when dialog opens
  useState(() => {
    if (open) setForm(initial ? { id: initial.id, title: initial.title, slug: initial.slug, excerpt: "", content: "", cover_image_url: initial.cover_image_url ?? "", category: initial.category ?? "", author: "", lang: (initial.lang as "fr") ?? "fr", status: (initial.status as "draft") ?? "draft" } : EMPTY);
  });

  const set = (k: keyof FormData, v: string) => setForm(prev => {
    const next = { ...prev, [k]: v };
    if (k === "title" && !prev.id) next.slug = toSlug(v);
    return next;
  });

  const saveMutation = useMutation({
    mutationFn: async (f: FormData) => {
      if (f.id) return updateArticle({ data: { ...f, id: f.id } as Parameters<typeof updateArticle>[0]["data"] });
      return createArticle({ data: f as Parameters<typeof createArticle>[0]["data"] });
    },
    onSuccess: () => {
      toast.success(form.id ? "Article mis à jour !" : "Article créé !");
      qc.invalidateQueries({ queryKey: ["admin-articles"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="bg-surface border-border/60 max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifier l'article" : "Nouvel article"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">

          {/* Titre + Slug */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Titre *</Label>
              <Input value={form.title} onChange={e => set("title", e.target.value)} required className="bg-background border-border/60" placeholder="Titre accrocheur..." />
            </div>
            <div className="space-y-1">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={e => set("slug", e.target.value)} className="bg-background border-border/60 font-mono text-sm" placeholder="auto-généré" />
            </div>
          </div>

          {/* Photo de couverture */}
          <div className="space-y-2">
            <Label>Photo de couverture</Label>
            {form.cover_image_url && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-surface-alt">
                <img src={form.cover_image_url} alt="couverture" className="w-full h-full object-cover" />
                <button type="button" onClick={() => set("cover_image_url", "")} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80">
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Input value={form.cover_image_url} onChange={e => set("cover_image_url", e.target.value)}
                placeholder="URL directe ou choisir via Unsplash ↓" className="bg-background border-border/60" />
              <Button type="button" variant="outline" onClick={() => setShowUnsplash(v => !v)} className="shrink-0">
                <Image className="h-4 w-4 mr-1" />Unsplash
              </Button>
            </div>
            {showUnsplash && <UnsplashPicker onSelect={url => { set("cover_image_url", url); setShowUnsplash(false); }} />}
          </div>

          {/* Extrait */}
          <div className="space-y-1">
            <Label>Extrait <span className="text-muted-foreground text-xs">(affiché dans les cartes)</span></Label>
            <Textarea value={form.excerpt} onChange={e => set("excerpt", e.target.value)} rows={2}
              placeholder="Courte description (120-150 caractères)..." className="bg-background border-border/60 resize-none" />
            <p className="text-xs text-muted-foreground text-right">{form.excerpt.length}/150</p>
          </div>

          {/* Contenu */}
          <div className="space-y-1">
            <Label>Contenu Markdown *</Label>
            <Textarea value={form.content} onChange={e => set("content", e.target.value)} rows={14} required
              placeholder={"## Introduction\n\nVotre contenu..."}
              className="bg-background border-border/60 font-mono text-sm resize-y" />
          </div>

          {/* Métadonnées */}
          <div className="grid grid-cols-4 gap-3">
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
              <Label>Auteur</Label>
              <Input value={form.author} onChange={e => set("author", e.target.value)} className="bg-background border-border/60" placeholder="Équipe HoliSwiss" />
            </div>
            <div className="space-y-1">
              <Label>Langue</Label>
              <Select value={form.lang} onValueChange={v => set("lang", v as "fr")}>
                <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-surface border-border/60">
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={v => set("status", v as "draft")}>
                <SelectTrigger className="bg-background border-border/60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-surface border-border/60">
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="published">Publié</SelectItem>
                  <SelectItem value="archived">Archivé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Enregistrement..." : form.status === "published" ? "✓ Publier" : "Sauvegarder"}
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

  const articles = data?.articles ?? [];

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (a: ArticleRow) => { setEditing(a); setDialogOpen(true); };

  return (
    <div className="p-6 md:p-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Articles de blog</h1>
          <p className="text-muted-foreground mt-1">{articles.length} article{articles.length !== 1 ? "s" : ""}</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />Nouvel article
        </Button>
      </div>

      <Separator className="bg-border/40" />

      {isLoading && <p className="text-muted-foreground">Chargement...</p>}

      {!isLoading && articles.length === 0 && (
        <Card className="bg-surface border-border/60">
          <CardContent className="p-10 text-center text-muted-foreground">
            Aucun article. Créez le premier avec le bouton ci-dessus.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {articles.map(a => (
          <Card key={a.id} className="bg-surface border-border/60">
            <CardContent className="p-4 flex items-center gap-4">
              {a.cover_image_url
                ? <img src={a.cover_image_url} alt={a.title} className="w-20 h-14 object-cover rounded-md shrink-0" />
                : <div className="w-20 h-14 bg-surface-alt rounded-md shrink-0 flex items-center justify-center text-muted-foreground"><Image className="h-5 w-5" /></div>
              }
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={
                    a.status === "published" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" :
                    a.status === "archived"  ? "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" :
                    "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                  }>
                    {a.status === "published" ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                    {a.status === "published" ? "Publié" : a.status === "archived" ? "Archivé" : "Brouillon"}
                  </Badge>
                  {a.category && <Badge variant="secondary" className="text-xs">{a.category}</Badge>}
                  <span className="text-xs text-muted-foreground uppercase">{a.lang}</span>
                </div>
                <p className="font-semibold text-foreground truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{a.slug}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                  onClick={() => { if (confirm(`Supprimer "${a.title}" ?`)) deleteMutation.mutate(a.id); }}>
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
