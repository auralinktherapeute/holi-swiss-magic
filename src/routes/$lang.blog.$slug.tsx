import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getArticleBySlug } from "@/lib/articles.functions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CalendarDays, User } from "lucide-react";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/$lang/blog/$slug")({ component: Page });

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(lang === "de" ? "de-CH" : "fr-CH", { day: "numeric", month: "long", year: "numeric" });
}

// Minimal Markdown renderer (bold, italic, headings, lists, paragraphs)
function renderMarkdown(md: string): string {
  return md
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
    .replace(/\n\n+/g, "</p><p>")
    .replace(/^(?!<[hul])/gm, "")
    .replace(/^(.+)$/gm, (line) => (line.startsWith("<") ? line : `<p>${line}</p>`))
    .replace(/<p><\/p>/g, "");
}

function Page() {
  const { lang, slug } = useParams({ from: "/$lang/blog/$slug" });
  const { t } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["article", slug],
    queryFn: () => getArticleBySlug({ data: { slug } }),
  });

  const article = data?.article;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="w-full aspect-video rounded-2xl" />
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <p className="text-2xl font-bold text-foreground mb-2">Article introuvable</p>
        <p className="text-muted-foreground mb-6">Cet article n'existe pas ou n'est plus disponible.</p>
        <Link to="/$lang/blog/" params={{ lang }} className="text-primary-light hover:underline flex items-center gap-1 justify-center">
          <ArrowLeft className="h-4 w-4" /> Retour au blog
        </Link>
      </div>
    );
  }

  return (
    <article className="min-h-screen bg-background">
      {/* Hero image */}
      {article.cover_image_url && (
        <div className="w-full aspect-[21/9] overflow-hidden max-h-96">
          <img src={article.cover_image_url} alt={article.title} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Back */}
        <Link to="/$lang/blog/" params={{ lang }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary-light mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> {t("nav.blog")}
        </Link>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {article.category && (
            <Badge variant="secondary" className="capitalize bg-primary/15 text-primary-light border-primary/20">
              {article.category}
            </Badge>
          )}
          {article.published_at && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-4 w-4" />
              {formatDate(article.published_at, lang)}
            </span>
          )}
          {article.author && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="h-4 w-4" />{article.author}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
          {article.title}
        </h1>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="text-lg text-muted-foreground border-l-4 border-primary/40 pl-4 mb-8 italic">
            {article.excerpt}
          </p>
        )}

        {/* Content */}
        {article.content && (
          <div
            className="prose prose-invert prose-purple max-w-none
              prose-headings:text-foreground prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-3
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-strong:text-foreground
              prose-li:text-muted-foreground
              prose-ul:my-4"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
          />
        )}

        {/* CTA */}
        <div className="mt-12 p-6 rounded-2xl bg-primary/10 border border-primary/20 text-center">
          <p className="text-foreground font-semibold mb-2">Trouver un thérapeute en Suisse</p>
          <p className="text-muted-foreground text-sm mb-4">Découvrez nos praticiens qualifiés près de chez vous.</p>
          <Link to="/$lang/therapeutes/" params={{ lang }}
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
            Voir les thérapeutes →
          </Link>
        </div>
      </div>
    </article>
  );
}
