import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen } from "lucide-react";
import { categoryLabel } from "@/lib/article-categories";
import { formatPublishedDate } from "@/lib/page-dates";
import type { HomeArticleLink } from "@/lib/home-links";
import type { SeoLang } from "@/lib/seo";

/**
 * « Derniers articles » de l'accueil — liens rendus au SSR depuis le loader
 * (même lecture que l'index `/blog`). Titre et slug dans la langue de la page.
 * Aucun article lisible : le bloc disparaît (jamais de squelette vide).
 */
export function HomeLatestArticles({
  articles,
  lang,
}: {
  articles: ReadonlyArray<HomeArticleLink>;
  /** Langue de l'URL (et non `i18n.language`) : identique au SSR et au client. */
  lang: SeoLang;
}) {
  const { t } = useTranslation();
  if (articles.length === 0) return null;

  return (
    <section
      aria-labelledby="home-latest-articles"
      className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-white">
            <BookOpen className="h-5 w-5 text-[#b86ef9]" aria-hidden />
            <h2
              id="home-latest-articles"
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {t("homeLinks.articles_title")}
            </h2>
          </div>
          <p className="mt-1 text-sm text-white/65">{t("homeLinks.articles_subtitle")}</p>
        </div>
        <Link
          to="/$lang/blog"
          params={{ lang }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.08)] px-5 py-2 text-sm font-semibold text-white transition hover:border-[#b86ef9] hover:bg-[rgba(184,110,249,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
        >
          {t("homeLinks.articles_all")}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => {
          const category = categoryLabel(a.category, lang);
          const date = formatPublishedDate(a.publishedAt, lang);
          return (
            <li key={a.id}>
              <Link
                to="/$lang/blog/$slug"
                params={{ lang, slug: a.slug }}
                className="group flex h-full overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#2d1248]/60 transition hover:border-[#b86ef9]/60 hover:bg-[#3d1a5c]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
              >
                <div className="relative w-28 shrink-0 overflow-hidden bg-gradient-to-br from-[#3d1a5c] to-[#1a1035] sm:w-32">
                  {a.cover ? (
                    <img
                      src={a.cover}
                      alt={a.coverAlt ?? ""}
                      loading="lazy"
                      decoding="async"
                      width={128}
                      height={128}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center" aria-hidden>
                      <BookOpen className="h-6 w-6 text-[#b86ef9]/60" />
                    </div>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-4">
                  {category && (
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5cc8fa]">
                      {category}
                    </span>
                  )}
                  <h3 className="line-clamp-3 text-[15px] font-semibold leading-snug text-white">
                    {a.title}
                  </h3>
                  {date && <span className="mt-auto pt-1 text-xs text-white/50">{date}</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
