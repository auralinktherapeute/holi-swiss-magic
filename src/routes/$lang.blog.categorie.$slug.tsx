import lotusAsset from "@/assets/lotus-transparent.png.asset.json";
import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getArticlesByCategory, titleForLang, excerptForLang, slugForLang } from "@/lib/articles.functions";
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
  /**
   * Rendu serveur de la catégorie.
   *
   * Avant : aucun loader. Un crawler recevait 167 mots, zéro lien d'article et
   * parfois pas de H1 — 112 URLs (28 catégories × 4 langues) indexables,
   * auto-canoniques, munies de hreflang, et vides. Une catégorie inconnue
   * renvoyait même 200 sur un écran « introuvable » (soft-404) : le
   * `notFound()` vivait dans le composant, donc après la réponse HTTP.
   */
  loader: async ({ params }) => {
    if (!getCategory(params.slug)) throw notFound();
    const lang = (params.lang as Lang) ?? "fr";
    try {
      let res = await getArticlesByCategory({ data: { slug: params.slug, lang } });
      // Les articles portent tous lang='fr' : sans ce repli, les catégories
      // DE/IT/EN seraient vides. Même logique que le listing du blog.
      if (!res?.articles?.length && lang !== "fr") {
        res = await getArticlesByCategory({ data: { slug: params.slug, lang: "fr" } });
      }
      return { articles: (res?.articles ?? []) as Array<Record<string, unknown>> };
    } catch {
      return { articles: [] as Array<Record<string, unknown>> };
    }
  },
  head: ({ params, loaderData }) => {
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

    const articles = (loaderData as { articles?: Array<Record<string, unknown>> } | undefined)?.articles;
    /**
     * Une catégorie n'est indexable qu'à partir de MIN_ARTICLES_INDEXABLE
     * articles — 18 des 28 catégories n'en comptent qu'un, et la taxonomie se
     * chevauche (yoga ↔ yoga-therapeutique, coaching ↔ coaching-holistique) :
     * les indexer toutes reviendrait à faire se concurrencer des pages minces
     * sur le même sujet.
     *
     * ⚠️ Le défaut est VOLONTAIREMENT « indexable » : si `loaderData` venait à
     * manquer, on n'émet pas de noindex. Le 25/08, une condition d'indexation
     * s'appuyant sur des données absentes avait désindexé d'un coup toutes les
     * pages spécialité × ville. Une donnée manquante ne doit jamais retirer une
     * page de l'index.
     */
    const thin = Array.isArray(articles) && articles.length < MIN_ARTICLES_INDEXABLE;

    const listed = (articles ?? []).filter((a) => a && typeof a["slug"] === "string");

    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(thin ? [{ name: "robots", content: "noindex,follow" }] : []),
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
      scripts:
        listed.length > 0 && !thin
          ? [
              {
                type: "application/ld+json",
                children: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "ItemList",
                  name: title,
                  numberOfItems: listed.length,
                  itemListElement: listed.map((a, i) => ({
                    "@type": "ListItem",
                    position: i + 1,
                    url: `https://holiswiss.ch/${lang}/blog/${slugForLang(a, lang)}`,
                    name: titleForLang(a, lang),
                  })),
                }),
              },
            ]
          : undefined,
    };
  },
});

/**
 * Seuil d'indexation d'une catégorie. Repris de la règle du cahier des charges
 * pour les pages ville (« therapeutes >= 3 → indexable »), qui vaut aussi ici :
 * une page de regroupement n'a d'intérêt qu'à partir de quelques éléments.
 * Une catégorie franchit le seuil d'elle-même à mesure que le blog s'étoffe.
 */
const MIN_ARTICLES_INDEXABLE = 3;

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

  // `initialData` vient du loader : la liste est ainsi présente dès le HTML
  // initial. Sans elle, un crawler ne voyait que le gabarit — 167 mots et zéro
  // lien d'article. La requête n'est ni debouncée ni filtrée et sa clé est
  // fixe : l'alimenter ne peut pas perturber le comportement client.
  const loaderData = Route.useLoaderData();
  const { data, isLoading } = useQuery({
    queryKey: ["articles-by-category", slug, l],
    initialData: loaderData?.articles ? { articles: loaderData.articles } : undefined,
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
                  params={{ lang: l, slug: slugForLang(a, l) || article.slug || "" }}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] hover:border-[#b86ef9] hover:shadow-[0_0_20px_rgba(184,110,249,0.15)] transition-all"
                >
                  <div className="aspect-video overflow-hidden bg-[#522870]">
                    {article.cover_image_url ? (
                      <img src={article.cover_image_url} alt={(article as any).image_alt_text || title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><img src={lotusAsset.url} alt="" className="w-12 h-12 opacity-80" /></div>
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