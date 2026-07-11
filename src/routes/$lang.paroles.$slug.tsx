import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublishedTherapistArticleBySlug } from "@/lib/therapist-articles.functions";
import { PublicNav } from "@/components/layout/PublicNav";
import { Footer } from "@/components/layout/Footer";
import { ArrowLeft, CalendarDays, User } from "lucide-react";
import { hreflangLinks, ogLocale } from "@/lib/seo";

export const Route = createFileRoute("/$lang/paroles/$slug")({
  component: Page,
  head: ({ params }) => {
    const title = "Article — Voix d'experts | Holiswiss";
    const url = `https://holiswiss.ch/${params.lang}/paroles/${params.slug}`;
    return {
      meta: [
        { title },
        { property: "og:title", content: title },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:locale", content: ogLocale(params.lang) },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks(`/paroles/${params.slug}`)],
    };
  },
});

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  const locale = { de: "de-CH", it: "it-CH", en: "en-GB" }[lang] ?? "fr-CH";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function Page() {
  const { lang, slug } = useParams({ from: "/$lang/paroles/$slug" });
  const { data, isLoading } = useQuery({
    queryKey: ["therapist-article", slug],
    queryFn: () => getPublishedTherapistArticleBySlug({ data: { slug } }),
  });

  const article = data as any;
  const t = article?.therapists;
  const name = t ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : "";

  return (
    <div className="min-h-screen bg-[#14082d] text-white">
      <PublicNav />
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10">
        <Link to="/$lang/paroles" params={{ lang }} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Retour aux articles
        </Link>

        {isLoading && (
          <div className="mt-8 space-y-4 animate-pulse">
            <div className="h-10 w-3/4 rounded bg-[#3d1a5c]" />
            <div className="h-4 w-1/3 rounded bg-[#3d1a5c]" />
            <div className="aspect-video rounded-2xl bg-[#3d1a5c] mt-6" />
          </div>
        )}

        {!isLoading && !article && (
          <div className="mt-10 text-center text-white/60">
            Article introuvable ou non publié.
          </div>
        )}

        {article && (
          <>
            <header className="mt-6">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">{article.titre}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/60">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{formatDate(article.date_publication, lang)}</span>
                {t && (
                  <Link
                    to="/$lang/therapeute/$slug"
                    params={{ lang, slug: t.slug }}
                    className="inline-flex items-center gap-2 hover:text-white"
                  >
                    {t.photo_url ? (
                      <img src={t.photo_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span>{name}{t.city ? ` · ${t.city}` : ""}</span>
                  </Link>
                )}
              </div>
            </header>

            {article.image_couverture && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                <img src={article.image_couverture} alt="" className="w-full h-auto object-cover" />
              </div>
            )}

            <div className="mt-8 prose prose-invert prose-lg max-w-none text-white/90 whitespace-pre-wrap leading-relaxed">
              {article.contenu}
            </div>

            {t && (
              <aside className="mt-12 rounded-2xl border border-[rgba(184,110,249,0.3)] bg-[#1d0d3d] p-6 flex items-center gap-4">
                {t.photo_url ? (
                  <img src={t.photo_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-[#3d1a5c] flex items-center justify-center text-lg font-semibold text-[#d4a8ff]">
                    {(name[0] ?? "?").toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/60">Auteur</div>
                  <div className="text-lg font-semibold">{name}</div>
                  {t.title && <div className="text-sm text-white/70">{t.title}{t.city ? ` — ${t.city}` : ""}</div>}
                </div>
                <Link
                  to="/$lang/therapeute/$slug"
                  params={{ lang, slug: t.slug }}
                  className="rounded-lg bg-[#b86ef9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Voir le profil
                </Link>
              </aside>
            )}
          </>
        )}
      </article>
      <Footer />
    </div>
  );
}