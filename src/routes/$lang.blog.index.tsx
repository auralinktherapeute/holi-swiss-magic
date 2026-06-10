import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublishedArticles, titleForLang, excerptForLang } from "@/lib/articles.functions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { CalendarDays, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/$lang/blog/")({ component: Page });

type Lang = "fr" | "de" | "it" | "en";

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  const locale = lang === "de" ? "de-CH" : lang === "it" ? "it-CH" : lang === "en" ? "en-GB" : "fr-CH";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function ArticleSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border/50">
      <Skeleton className="w-full aspect-video" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-4 w-24" /><Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

function Page() {
  const { lang } = useParams({ from: "/$lang/blog/" });
  const { t } = useTranslation();
  const l = (lang as Lang) ?? "fr";

  const { data, isLoading } = useQuery({
    queryKey: ["articles", l],
    queryFn: () => getPublishedArticles({ data: { lang: l } }),
  });

  const articles = data?.articles ?? [];

  return (
    <div className="min-h-screen bg-background">
      <section className="py-16 px-4 text-center border-b border-border/30">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{t("nav.blog")}</h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Conseils, pratiques et inspirations pour votre bien-être holistique en Suisse.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-4 py-12">
        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <ArticleSkeleton key={i} />)}
          </div>
        )}

        {!isLoading && articles.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">Aucun article publié pour l'instant.</p>
            <p className="text-sm mt-2">Revenez bientôt !</p>
          </div>
        )}

        {!isLoading && articles.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map(article => {
              const a = article as Record<string, unknown>;
              const title = titleForLang(a, l);
              const excerpt = excerptForLang(a, l);
              return (
                <Link key={article.id} to="/$lang/blog/$slug" params={{ lang: l, slug: article.slug ?? "" }}
                  className="group rounded-2xl overflow-hidden bg-card border border-border/50 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/10 flex flex-col">
                  <div className="aspect-video overflow-hidden bg-surface-alt">
                    {article.cover_image_url
                      ? <img src={article.cover_image_url} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl">🌿</div>
                    }
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {article.category && (
                        <Badge variant="secondary" className="text-xs capitalize bg-primary/15 text-primary-light border-primary/20">{article.category}</Badge>
                      )}
                      {article.published_at && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />{formatDate(article.published_at, l)}
                        </span>
                      )}
                    </div>
                    <h2 className="font-bold text-foreground text-lg leading-snug mb-2 group-hover:text-primary-light transition-colors">{title}</h2>
                    {excerpt && <p className="text-muted-foreground text-sm line-clamp-3 flex-1">{excerpt}</p>}
                    <div className="mt-4 flex items-center gap-1 text-primary-light text-sm font-medium">
                      Lire l'article <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
