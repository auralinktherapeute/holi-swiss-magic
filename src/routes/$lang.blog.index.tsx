import lotusAsset from "@/assets/lotus-transparent.png.asset.json";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublishedArticles, titleForLang, excerptForLang } from "@/lib/articles.functions";
import { CalendarDays, ArrowRight, BookOpen } from "lucide-react";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { categoryLabel } from "@/lib/article-categories";
import { blogCopy } from "@/lib/blog-copy";
import { FaqSection } from "@/components/holiswiss/FaqSection";
import { BLOG_FAQ, FAQ_TITLES, asFaqLang } from "@/lib/faq-content";

export const Route = createFileRoute("/$lang/blog/")({
  component: Page,
  head: ({ params }) => {
    const lang = params.lang;
    const titles: Record<string, string> = {
      fr: "Blog bien-être & thérapies holistiques — Holiswiss",
      de: "Blog Wohlbefinden & ganzheitliche Therapien — Holiswiss",
      it: "Blog benessere & terapie olistiche — Holiswiss",
      en: "Wellness & holistic therapies blog — Holiswiss",
    };
    const descs: Record<string, string> = {
      fr: "Conseils, dossiers et actualités sur les thérapies holistiques en Suisse : sophrologie, hypnose, naturopathie, méditation et plus.",
      de: "Ratgeber, Hintergrundartikel und News zu ganzheitlichen Therapien in der Schweiz: Sophrologie, Hypnose, Naturheilkunde, Meditation und mehr.",
      it: "Consigli, approfondimenti e notizie sulle terapie olistiche in Svizzera: sofrologia, ipnosi, naturopatia, meditazione e altro.",
      en: "Tips, deep-dives and news on holistic therapies in Switzerland: sophrology, hypnosis, naturopathy, meditation and more.",
    };
    const title = titles[lang] ?? titles.fr;
    const description = descs[lang] ?? descs.fr;
    const url = `https://holiswiss.ch/${lang}/blog`;
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
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/blog")],
    };
  },
});

type Lang = "fr" | "de" | "it" | "en";

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  const locale = { de: "de-CH", it: "it-CH", en: "en-GB" }[lang] ?? "fr-CH";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] overflow-hidden animate-pulse">
      <div className="aspect-video bg-[#522870]" />
      <div className="p-5 space-y-3">
        <div className="h-3 w-20 rounded bg-[#522870]" />
        <div className="h-5 w-4/5 rounded bg-[#522870]" />
        <div className="h-3 w-full rounded bg-[#522870]" />
        <div className="h-3 w-2/3 rounded bg-[#522870]" />
      </div>
    </div>
  );
}

function Page() {
  const { lang } = useParams({ from: "/$lang/blog/" });
  const l = (lang as Lang) ?? "fr";
  const copy = blogCopy(l);

  const { data, isLoading } = useQuery({
    queryKey: ["articles", l],
    queryFn: async () => {
      const res = await getPublishedArticles({ data: { lang: l } });
      // Fallback FR si aucun article dans la langue sélectionnée
      if (!res?.articles?.length && l !== "fr") {
        return getPublishedArticles({ data: { lang: "fr" } });
      }
      return res;
    },
  });

  const articles = data?.articles ?? [];
  const [featured, ...rest] = articles;

  return (
    <div className="min-h-screen bg-[#2d1248]">

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden py-20 px-4"
        style={{ background: "linear-gradient(160deg, #2d1248 0%, #3d1a5c 50%, #2d1248 100%)" }}
      >
        {/* Glow orbs */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-[#b86ef9]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#5cc8fa]/8 blur-3xl" />

        <div className="relative mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.1)] px-4 py-1.5 text-sm text-[#d4a5f9] mb-6">
            <BookOpen className="h-4 w-4" />
            {copy.badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
            {copy.heroTitlePart1} {" "}
            <span
              className="bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {copy.heroTitleHighlight}
            </span>
          </h1>
          <p className="text-lg text-[#d4c4e0] max-w-xl mx-auto">
            {copy.heroSubtitle}
          </p>
        </div>
      </section>

      {/* ── Contenu ── */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">

        {/* Skeletons */}
        {isLoading && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
          </div>
        )}

        {/* Vide */}
        {!isLoading && articles.length === 0 && (
          <div className="text-center py-24">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgba(184,110,249,0.1)] border border-[rgba(184,110,249,0.2)] mb-4">
              <BookOpen className="h-7 w-7 text-[#b86ef9]" />
            </div>
            <p className="text-lg font-semibold text-white">{copy.emptyTitle}</p>
            <p className="text-[#d4c4e0] text-sm mt-1">{copy.emptySubtitle}</p>
          </div>
        )}

        {/* Article vedette */}
        {!isLoading && featured && (() => {
          const a = featured as Record<string, unknown>;
          const title = titleForLang(a, l);
          const excerpt = excerptForLang(a, l);
          return (
            <Link
              to="/$lang/blog/$slug"
              params={{ lang: l, slug: featured.slug ?? "" }}
              className="group mb-10 flex flex-col md:flex-row overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c] hover:border-[#b86ef9] hover:shadow-[0_0_30px_rgba(184,110,249,0.2)] transition-all"
            >
              <div className="md:w-1/2 aspect-video md:aspect-auto overflow-hidden bg-[#522870]">
                {featured.cover_image_url
                  ? <img src={featured.cover_image_url} alt={(a["image_alt_text"] as string | undefined) || title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="eager" />
                  : <div className="w-full h-full flex items-center justify-center"><img src={lotusAsset.url} alt="" className="w-16 h-16 opacity-80" /></div>
                }
              </div>
              <div className="md:w-1/2 flex flex-col justify-center p-8">
                <div className="flex items-center gap-2 mb-3">
                  {featured.category && (
                    <span className="inline-flex items-center rounded-full border border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.12)] px-3 py-1 text-xs font-medium text-[#d4a5f9]">
                      {categoryLabel(featured.category, l)}
                    </span>
                  )}
                  <span className="inline-flex items-center rounded-full bg-gradient-to-r from-[#b86ef9]/20 to-[#5cc8fa]/20 border border-[#5cc8fa]/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#5cc8fa]">
                    {copy.featured}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white leading-tight mb-3 group-hover:text-[#d4a5f9] transition-colors">
                  {title}
                </h2>
                {excerpt && <p className="text-[#d4c4e0] text-sm leading-relaxed mb-4 line-clamp-3">{excerpt}</p>}
                {featured.published_at && (
                  <p className="text-xs text-[#d4c4e0]/60 flex items-center gap-1 mb-4">
                    <CalendarDays className="h-3 w-3" />{formatDate(featured.published_at, l)}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#b86ef9] group-hover:text-[#d4a5f9] transition-colors">
                  {copy.readArticle} <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
            </Link>
          );
        })()}

        {/* Grille des autres articles */}
        {!isLoading && rest.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((article: any) => {
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
                    {article.cover_image_url
                      ? <img src={article.cover_image_url} alt={(a["image_alt_text"] as string | undefined) || title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center"><img src={lotusAsset.url} alt="" className="w-12 h-12 opacity-80" /></div>
                    }
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

        <FaqSection
          items={BLOG_FAQ[asFaqLang(l)]}
          title={FAQ_TITLES[asFaqLang(l)].title}
          subtitle={FAQ_TITLES[asFaqLang(l)].subtitle}
          className="mx-auto w-full max-w-3xl px-0 py-16"
        />
      </div>
    </div>
  );
}
