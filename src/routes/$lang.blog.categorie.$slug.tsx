import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getArticlesByCategory, titleForLang, excerptForLang } from "@/lib/articles.functions";
import { categoryLabel, getCategory, GROUP_LABELS, type GroupKey } from "@/lib/article-categories";
import { CalendarDays, ArrowRight, BookOpen, ArrowLeft } from "lucide-react";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { blogCopy } from "@/lib/blog-copy";

type Lang = "fr" | "de" | "it" | "en";

export const Route = createFileRoute("/$lang/blog/categorie/$slug")({
  component: Page,
  errorComponent: () => (
    <div className="min-h-screen bg-[#2d1248] text-white p-10 text-center">
      <p>Une erreur est survenue.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-[#2d1248] text-white p-10 text-center">
      <p>Catégorie introuvable.</p>
    </div>
  ),
  head: ({ params }) => {
    const lang = (params.lang as Lang) ?? "fr";
    const cat = getCategory(params.slug);
    const name = cat ? cat[`name_${lang}` as const] || cat.name_fr : params.slug;
    const titles: Record<Lang, string> = {
      fr: `${name} en Suisse — Articles & guides | Holiswiss`,
      de: `${name} in der Schweiz — Artikel & Ratgeber | Holiswiss`,
      it: `${name} in Svizzera — Articoli & guide | Holiswiss`,
      en: `${name} in Switzerland — Articles & guides | Holiswiss`,
    };
    const descs: Record<Lang, string> = {
      fr: `Découvrez tous les articles, guides et conseils sur ${name} en Suisse romande et alémanique. Holiswiss, l'annuaire des thérapeutes.`,
      de: `Alle Artikel, Ratgeber und Tipps zu ${name} in der Schweiz auf Holiswiss.`,
      it: `Tutti gli articoli e le guide su ${name} in Svizzera, su Holiswiss.`,
      en: `All articles, guides and tips on ${name} in Switzerland on Holiswiss.`,
    };
    const title = titles[lang];
    const description = descs[lang];
    const url = `https://holiswiss.ch/${lang}/blog/categorie/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(lang) },
      ],
      links: [
        { rel: "canonical", href: url },
        ...hreflangLinks(`/blog/categorie/${params.slug}`),
      ],
    };
  },
});

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  const locale = { de: "de-CH", it: "it-CH", en: "en-GB" }[lang] ?? "fr-CH";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function Page() {
  const { lang, slug } = useParams({ from: "/$lang/blog/categorie/$slug" });
  const l = (lang as Lang) ?? "fr";
  const copy = blogCopy(l);
  const cat = getCategory(slug);

  if (!cat) {
    throw notFound();
  }

  const name = cat[`name_${l}` as const] || cat.name_fr;
  const groupLabel = GROUP_LABELS[cat.parent as GroupKey][l];

  const { data, isLoading } = useQuery({
    queryKey: ["articles-by-category", slug, l],
    queryFn: async () => {
      const res = await getArticlesByCategory({ data: { slug, lang: l } });
      if (!res?.articles?.length && l !== "fr") {
        return getArticlesByCategory({ data: { slug, lang: "fr" } });
      }
      return res;
    },
  });

  const articles = data?.articles ?? [];

  return (
    <div className="min-h-screen bg-[#2d1248]">
      <section
        className="relative overflow-hidden py-16 px-4"
        style={{ background: "linear-gradient(160deg, #2d1248 0%, #3d1a5c 50%, #2d1248 100%)" }}
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#b86ef9]/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <Link
            to="/$lang/blog"
            params={{ lang: l }}
            className="inline-flex items-center gap-1 text-sm text-[#d4a5f9] hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4" /> {copy.navBlog}
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.1)] px-4 py-1.5 text-xs uppercase tracking-wider text-[#d4a5f9] mb-4">
            <BookOpen className="h-4 w-4" />
            {groupLabel}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-3">
            {name}
          </h1>
          <p className="text-[#d4c4e0]">
            {articles.length > 0
              ? copy.categoryCount(articles.length)
              : copy.categoryComingSoon}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] overflow-hidden animate-pulse">
                <div className="aspect-video bg-[#522870]" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-4/5 rounded bg-[#522870]" />
                  <div className="h-3 w-full rounded bg-[#522870]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && articles.length === 0 && (
          <div className="text-center py-24">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(184,110,249,0.1)] border border-[rgba(184,110,249,0.2)] mb-4">
              <BookOpen className="h-7 w-7 text-[#b86ef9]" />
            </div>
            <p className="text-lg font-semibold text-white">{copy.categoryEmpty(name)}</p>
            <Link
              to="/$lang/blog"
              params={{ lang: l }}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#b86ef9] hover:text-[#d4a5f9]"
            >
              {copy.seeAllBlog} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {!isLoading && articles.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article: any) => {
              const a = article as Record<string, unknown>;
              const title = titleForLang(a, l);
              const excerpt = excerptForLang(a, l);
              return (
                <Link
                  key={article.id}
                  to="/$lang/blog/$slug"
                  params={{ lang: l, slug: article.slug ?? "" }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] hover:border-[#b86ef9] hover:shadow-[0_0_20px_rgba(184,110,249,0.15)] transition-all"
                >
                  <div className="aspect-video overflow-hidden bg-[#522870]">
                    {article.cover_image_url ? (
                      <img src={article.cover_image_url} alt={(article as any).image_alt_text || title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">🌿</div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 p-5">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      {article.category && (
                        <span className="rounded-full border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.1)] px-2.5 py-0.5 text-[11px] font-medium text-[#d4a5f9]">
                          {categoryLabel(article.category, l)}
                        </span>
                      )}
                      {article.published_at && (
                        <span className="text-[11px] text-[#d4c4e0]/60 flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />{formatDate(article.published_at, l)}
                        </span>
                      )}
                    </div>
                    <h2 className="font-bold text-white text-base leading-snug mb-2 group-hover:text-[#d4a5f9] transition-colors line-clamp-2">
                      {title}
                    </h2>
                    {excerpt && (
                      <p className="text-[#d4c4e0] text-sm line-clamp-3 flex-1 leading-relaxed">{excerpt}</p>
                    )}
                    <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#b86ef9] group-hover:text-[#d4a5f9] transition-colors">
                      {copy.read} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}