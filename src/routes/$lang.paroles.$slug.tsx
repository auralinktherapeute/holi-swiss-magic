import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublishedTherapistArticleBySlug } from "@/lib/therapist-articles.functions";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import { ArticleContent } from "@/components/articles/ArticleContent";

import { ArrowLeft, CalendarDays } from "lucide-react";
import { ogLocale, resolveProfileLang } from "@/lib/seo";
import { organizationRef, publisherNode } from "@/lib/organization-schema";
import { NotFoundPage } from "@/components/layout/NotFoundPage";
import { articleDates, CONTENT_DATE_COLUMN, formatPublishedDate, visibleArticleUpdate } from "@/lib/page-dates";
import { LastUpdated } from "@/components/holiswiss/LastUpdated";

export const Route = createFileRoute("/$lang/paroles/$slug")({
  component: Page,
  /**
   * Sans loader, ces pages n'avaient ni H1 ni titre propre : toutes les
   * « Voix d'experts » partageaient le même title générique, dans les quatre
   * langues, et le contenu n'arrivait qu'après le JavaScript. Détecté par
   * npm run seo:check.
   */
  loader: async ({ params }) => {
    const article = await getPublishedTherapistArticleBySlug({ data: { slug: params.slug } });
    if (!article) throw notFound();
    return { article: article as Record<string, unknown> };
  },
  notFoundComponent: () => <NotFoundPage />,
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
    // Une seule langue indexable : `therapist_articles` n'a qu'une colonne
    // `titre`, sans traduction. Les quatre URLs servaient le même texte, ce que
    // npm run seo:check a signalé (« title identique à … »). La langue suit le
    // canton de l'auteur — même règle que sa fiche et que ses événements. Pas
    // de hreflang : une grappe hreflang suppose des membres canoniques d'eux-mêmes.
    const contentLang = resolveProfileLang(null, a?.therapists?.canton, null);
    const canonicalUrl = `https://holiswiss.ch/${contentLang}/paroles/${params.slug}`;
    const pageUrl = a?.titre ? canonicalUrl : url;
    // Image RÉELLE, celle que la page affiche (`image_couverture`) et seulement
    // si c'est déjà une URL absolue. Aucun repli sur le logo : ce serait annoncer
    // aux réseaux sociaux une illustration que l'article n'a pas.
    const cover = typeof a?.image_couverture === "string" && /^https?:\/\//.test(a.image_couverture)
      ? (a.image_couverture as string)
      : null;
    const authorSlug = a?.therapists?.slug ? String(a.therapists.slug) : null;
    const authorUrl = authorSlug
      ? `https://holiswiss.ch/${contentLang}/therapeute/${authorSlug}`
      : null;
    const meta: Array<Record<string, string>> = [
      { title },
      ...(!a ? [{ name: "robots", content: "noindex,follow" }] : []),
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: pageUrl },
      { property: "og:locale", content: ogLocale(contentLang) },
      // Sans `twitter:title` / `twitter:description` ici, l'aperçu X héritait du
      // titre et de la description de l'accueil, en français.
      { name: "twitter:card", content: cover ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      ...(cover
        ? [{ property: "og:image", content: cover }, { name: "twitter:image", content: cover }]
        : []),
    ];
    const bcHome: Record<string, string> = { fr: "Accueil", de: "Startseite", it: "Home", en: "Home" };
    const bcParoles: Record<string, string> = {
      fr: "Voix d'experts", de: "Expertenstimmen", it: "Voci di esperti", en: "Expert voices",
    };
    // `date_publication` et CONTENT_DATE_COLUMN réels (therapist_articles n'a pas de
    // `published_at`), réexprimés à l'heure de Zurich comme la page visible.
    const dates = articleDates(a?.date_publication, a?.[CONTENT_DATE_COLUMN]);
    const ld = a?.titre
      ? {
          "@context": "https://schema.org",
          "@type": "Article",
          // `@id` stable : sans lui, chaque moteur inventait sa propre clé et le
          // nœud ne pouvait pas fusionner avec la WebPage.
          "@id": `${pageUrl}#article`,
          headline: a.titre,
          description,
          mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
          url: pageUrl,
          inLanguage: contentLang,
          author: author
            ? { "@type": "Person", name: author, ...(authorUrl ? { url: authorUrl } : {}) }
            : organizationRef,
          // Le publisher n'avait pas de `logo` : champ requis du résultat
          // enrichi Article. Il vient maintenant du nœud partagé.
          publisher: publisherNode,
          ...(cover ? { image: [cover] } : {}),
          ...(dates.published ? { datePublished: dates.published.iso } : {}),
          // `dateModified` uniquement si la donnée existe réellement en base.
          ...(dates.modified ? { dateModified: dates.modified.iso } : {}),
        }
      : null;
    const breadcrumb = a?.titre
      ? {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: bcHome[contentLang] ?? bcHome.fr, item: `https://holiswiss.ch/${contentLang}` },
            { "@type": "ListItem", position: 2, name: bcParoles[contentLang] ?? bcParoles.fr, item: `https://holiswiss.ch/${contentLang}/paroles` },
            { "@type": "ListItem", position: 3, name: a.titre, item: pageUrl },
          ],
        }
      : null;
    return {
      meta,
      links: [{ rel: "canonical", href: pageUrl }],
      ...(ld
        ? {
            scripts: [
              { type: "application/ld+json", children: JSON.stringify(ld) },
              ...(breadcrumb ? [{ type: "application/ld+json", children: JSON.stringify(breadcrumb) }] : []),
            ],
          }
        : {}),
    };
  },
});

// Jour de Zurich, formatage manuel (sans Intl) : identique au SSR et au client.
function formatDate(iso: string | null, lang: string) {
  return formatPublishedDate(iso, lang);
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
  const updated = article
    ? visibleArticleUpdate(articleDates(article.date_publication, article[CONTENT_DATE_COLUMN]))
    : null;

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
                <LastUpdated as="span" modified={updated} lang={lang} className="text-sm text-white/60" />
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

            <ArticleContent
              source={article.contenu}
              className="mt-8 max-w-none text-lg text-white/90"
            />


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
