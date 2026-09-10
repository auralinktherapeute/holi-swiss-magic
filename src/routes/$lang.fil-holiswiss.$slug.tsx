import { createFileRoute, Link, notFound, useParams } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CalendarDays } from "lucide-react";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";
import { ArticleContent } from "@/components/articles/ArticleContent";
import { NotFoundPage } from "@/components/layout/NotFoundPage";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import {
  FIL_COPY,
  asFilLang,
  filCategoryLabel,
  formatFilDate,
} from "@/data/fil-holiswiss";
import { getFilPost } from "@/lib/fil.functions";

export const Route = createFileRoute("/$lang/fil-holiswiss/$slug")({
  component: Page,
  loader: async ({ params }) => {
    const res = await getFilPost({ data: { slug: params.slug, lang: asFilLang(params.lang) } });
    if (!res?.post) throw notFound();
    return { post: res.post, related: res.related ?? [] };
  },
  notFoundComponent: () => <NotFoundPage />,
  head: ({ params, loaderData }) => {
    const l = asFilLang(params.lang);
    if (!loaderData) {
      return { meta: [{ title: "Introuvable — Holiswiss" }, { name: "robots", content: "noindex" }] };
    }
    const post = loaderData.post;
    const title = post.seoTitle || `${post.title} — Holiswiss`;
    const description = post.seoDescription || post.excerpt;
    const url = `https://holiswiss.ch/${l}/fil-holiswiss/${post.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "og:locale", content: ogLocale(l) },
        { name: "twitter:card", content: "summary_large_image" },
        ...(post.image
          ? [
              { property: "og:image", content: post.image },
              { name: "twitter:image", content: post.image },
            ]
          : []),
      ],
      links: [
        { rel: "canonical", href: url },
        ...hreflangLinks(`/fil-holiswiss/${post.slug}`),
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description,
            datePublished: post.date,
            mainEntityOfPage: url,
            ...(post.author ? { author: { "@type": "Person", name: post.author } } : {}),
            ...(post.image ? { image: post.image } : {}),
          }),
        },
      ],
    };
  },
});

function Page() {
  const { lang } = useParams({ from: "/$lang/fil-holiswiss/$slug" });
  const l = asFilLang(lang);
  const copy = FIL_COPY[l];
  const { post, related } = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-[#2d1248]">
      <section
        className="relative overflow-hidden px-4 py-16"
        style={{ background: "linear-gradient(160deg, #2d1248 0%, #3d1a5c 50%, #2d1248 100%)" }}
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[360px] w-[560px] -translate-x-1/2 rounded-full bg-[#b86ef9]/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <Link
            to="/$lang/fil-holiswiss"
            params={{ lang: l }}
            className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#d4a5f9] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {copy.back}
          </Link>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.12)] px-3 py-1 text-xs font-medium text-[#d4a5f9]">
              {filCategoryLabel(post.category, l)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-[#d4c4e0]/60">
              <CalendarDays className="h-3 w-3" />
              {formatFilDate(post.date, l)}
            </span>
            {post.author && (
              <span className="text-[11px] text-[#d4c4e0]/60">
                {copy.by} {post.author}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">{post.title}</h1>
          <p className="mt-4 text-lg text-[#d4c4e0]">{post.excerpt}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-10 overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c]">
          {post.image ? (
            <img
              src={post.image}
              alt={post.imageAlt || post.title}
              className="aspect-video w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex aspect-[21/9] w-full items-center justify-center bg-[#522870]">
              <img src={lotusAsset.url} alt="" className="h-16 w-16 opacity-80" />
            </div>
          )}
        </div>

        <ArticleContent source={post.content} className="text-[#e6dcf0]" />
      </div>

      {related.length > 0 && (
        <section aria-labelledby="fil-related" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <h2
            id="fil-related"
            className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#d4c4e0]/70"
          >
            {copy.related}
          </h2>
          <div className="grid gap-6 md:grid-cols-3">
            {related.map((p) => (
              <Link
                key={p.id}
                to="/$lang/fil-holiswiss/$slug"
                params={{ lang: l, slug: p.slug }}
                className="group flex flex-col rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] p-5 transition-all hover:border-[#b86ef9] hover:shadow-[0_0_20px_rgba(184,110,249,0.15)]"
              >
                <span className="mb-3 w-fit rounded-full border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.1)] px-2.5 py-0.5 text-[11px] font-medium text-[#d4a5f9]">
                  {filCategoryLabel(p.category, l)}
                </span>
                <h3 className="mb-2 line-clamp-2 font-bold leading-snug text-white transition-colors group-hover:text-[#d4a5f9]">
                  {p.title}
                </h3>
                <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-[#d4c4e0]">{p.excerpt}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#b86ef9] transition-colors group-hover:text-[#d4a5f9]">
                  {copy.discover}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
