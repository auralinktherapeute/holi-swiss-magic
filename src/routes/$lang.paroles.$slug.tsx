import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublishedTherapistArticleBySlug } from "@/lib/therapist-articles.functions";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { hreflangLinks, ogLocale } from "@/lib/seo";

export const Route = createFileRoute("/$lang/paroles/$slug")({
  component: Page,
  /**
   * Sans loader, ces pages n'avaient ni H1 ni titre propre : toutes les
   * « Voix d'experts » partageaient le même title générique, dans les quatre
   * langues, et le contenu n'arrivait qu'après le JavaScript. Détecté par
   * npm run seo:check.
   */
  loader: async ({ params }) => {
    try {
      const article = await getPublishedTherapistArticleBySlug({ data: { slug: params.slug } });
      return { article: (article as Record<string, unknown> | null) ?? null };
    } catch {
      return { article: null };
    }
  },
  head: ({ params, loaderData }) => {
    const a = (loaderData as any)?.article;
    const url = `https://holiswiss.ch/${params.lang}/paroles/${params.slug}`;
    const author = a?.therapists
      ? `${a.therapists.first_name ?? ""} ${a.therapists.last_name ?? ""}`.trim()
      : "";
    const title = a?.titre
      ? `${a.titre}${author ? ` — ${author}` : ""} | Holiswiss`
      : "Article — Voix d'experts | Holiswiss";
    const raw = (a?.extrait || a?.contenu || "") as string;
    const description =
      (raw ? String(raw).replace(/[#*_>\-\[\]()]/g, " ").replace(/\s+/g, " ").trim() : "").slice(0, 160) ||
      "Regards et conseils de praticiens holistiques en Suisse, sur Holiswiss.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { property: "og:locale", content: ogLocale(params.lang) },
    ];
    const ld = a?.titre
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: a.titre,
          description,
          mainEntityOfPage: url,
          url,
          inLanguage: params.lang,
          author: author
            ? { "@type": "Person", name: author }
            : { "@type": "Organization", name: "Holiswiss" },
          publisher: { "@type": "Organization", name: "Holiswiss", url: "https://holiswiss.ch" },
          ...(a.date_publication ? { datePublished: a.date_publication } : {}),
        }
      : null;
    return {
      meta,
      links: [{ rel: "canonical", href: url }, ...hreflangLinks(`/paroles/${params.slug}`)],
      ...(ld ? { scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }] } : {}),
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
  // `initialData` vient du loader : titre, auteur et corps sont dans le HTML
  // initial. Requête à clé fixe, ni debouncée ni filtrée.
  const loaderData = Route.useLoaderData();
  const { data, isLoading } = useQuery({
    queryKey: ["therapist-article", slug],
    initialData: (loaderData?.article ?? undefined) as any,
    queryFn: () => getPublishedTherapistArticleBySlug({ data: { slug } }),
  });

  const article = data as any;
  const t = article?.therapists;
  const name = t ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : "";

  return (
    <div className="min-h-screen bg-[#14082d] text-white">
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
                    <span className="inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-full">
                      <TherapistAvatar
                        photoUrl={t.photo_url}
                        alt={name}
                        fallback={(name[0] ?? "?").toUpperCase()}
                        fallbackClassName="flex h-full w-full items-center justify-center bg-[#3d1a5c] text-[10px] font-semibold text-[#d4a8ff]"
                      />
                    </span>
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
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full">
                  <TherapistAvatar
                    photoUrl={t.photo_url}
                    alt={name}
                    fallback={(name[0] ?? "?").toUpperCase()}
                    fallbackClassName="flex h-full w-full items-center justify-center bg-[#3d1a5c] text-lg font-semibold text-[#d4a8ff]"
                  />
                </div>
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
    </div>
  );
}