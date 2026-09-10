import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Sparkles } from "lucide-react";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import {
  FIL_COPY,
  asFilLang,
  featuredFilPost,
  filCategoryLabel,
  formatFilDate,
  publishedFilPosts,
  usedFilCategories,
} from "@/data/fil-holiswiss";

export const Route = createFileRoute("/$lang/fil-holiswiss/")({
  component: Page,
  head: ({ params }) => {
    const l = asFilLang(params.lang);
    const copy = FIL_COPY[l];
    const url = `https://holiswiss.ch/${l}/fil-holiswiss`;
    return {
      meta: [
        { title: copy.metaTitle },
        { name: "description", content: copy.metaDescription },
        { property: "og:title", content: copy.metaTitle },
        { property: "og:description", content: copy.metaDescription },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(l) },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/fil-holiswiss")],
    };
  },
});

function Page() {
  const { lang } = useParams({ from: "/$lang/fil-holiswiss/" });
  const l = asFilLang(lang);
  const copy = FIL_COPY[l];

  const posts = useMemo(() => publishedFilPosts(), []);
  const categories = useMemo(() => usedFilCategories(), []);
  const featured = useMemo(() => featuredFilPost(), []);
  const [active, setActive] = useState<string | null>(null);

  const list = useMemo(
    () =>
      posts
        .filter((p) => (active ? p.category === active : p.slug !== featured?.slug)),
    [posts, active, featured],
  );

  return (
    <div className="min-h-screen bg-[#2d1248]">
      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden px-4 py-20"
        style={{ background: "linear-gradient(160deg, #2d1248 0%, #3d1a5c 50%, #2d1248 100%)" }}
      >
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-[#b86ef9]/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#5cc8fa]/8 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.1)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#d4a5f9]">
            <Sparkles className="h-4 w-4" />
            {copy.kicker}
          </div>
          <h1 className="mb-4 text-4xl font-bold leading-tight text-white md:text-5xl">
            <span
              className="bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] bg-clip-text text-transparent"
              style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
            >
              {copy.title}
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-[#d4c4e0]">{copy.subtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        {/* ── À découvrir ── */}
        {featured && !active && (
          <section aria-labelledby="fil-featured" className="mb-12">
            <h2
              id="fil-featured"
              className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#d4c4e0]/70"
            >
              {copy.featuredLabel}
            </h2>
            <Link
              to="/$lang/fil-holiswiss/$slug"
              params={{ lang: l, slug: featured.slug }}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.25)] bg-[#3d1a5c] transition-all hover:border-[#b86ef9] hover:shadow-[0_0_30px_rgba(184,110,249,0.2)] md:flex-row"
            >
              <div className="aspect-video overflow-hidden bg-[#522870] md:aspect-auto md:w-1/2">
                {featured.image ? (
                  <img
                    src={featured.image}
                    alt={featured.imageAlt || featured.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="eager"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center py-14">
                    <img src={lotusAsset.url} alt="" className="h-16 w-16 opacity-80" />
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center p-8 md:w-1/2">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-[rgba(184,110,249,0.4)] bg-[rgba(184,110,249,0.12)] px-3 py-1 text-xs font-medium text-[#d4a5f9]">
                    {filCategoryLabel(featured.category, l)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#d4c4e0]/60">
                    <CalendarDays className="h-3 w-3" />
                    {formatFilDate(featured.date, l)}
                  </span>
                </div>
                <h3 className="mb-3 text-2xl font-bold leading-tight text-white transition-colors group-hover:text-[#d4a5f9]">
                  {featured.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-[#d4c4e0]">{featured.excerpt}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#b86ef9] transition-colors group-hover:text-[#d4a5f9]">
                  {copy.discover}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </section>
        )}

        {/* ── Filtres ── */}
        <nav aria-label={copy.title} className="mb-8">
          <ul className="flex flex-wrap gap-2">
            <li>
              <button
                type="button"
                onClick={() => setActive(null)}
                aria-pressed={active === null}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 py-1.5 text-sm transition-colors ${
                  active === null
                    ? "border-[#b86ef9] bg-[rgba(184,110,249,0.22)] text-white"
                    : "border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] text-[#d4a5f9] hover:border-[#b86ef9] hover:bg-[rgba(184,110,249,0.18)]"
                }`}
              >
                {copy.all}
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => setActive(c.slug)}
                  aria-pressed={active === c.slug}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    active === c.slug
                      ? "border-[#b86ef9] bg-[rgba(184,110,249,0.22)] text-white"
                      : "border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] text-[#d4a5f9] hover:border-[#b86ef9] hover:bg-[rgba(184,110,249,0.18)]"
                  }`}
                >
                  {filCategoryLabel(c.slug, l)}
                  <span className="text-[11px] text-[#d4c4e0]/50">{c.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Grille ── */}
        {list.length === 0 ? (
          <p className="py-16 text-center text-[#d4c4e0]">{copy.empty}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {list.map((p) => (
              <Link
                key={p.id}
                to="/$lang/fil-holiswiss/$slug"
                params={{ lang: l, slug: p.slug }}
                className="group flex animate-fade-in flex-col overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] transition-all hover:border-[#b86ef9] hover:shadow-[0_0_20px_rgba(184,110,249,0.15)]"
              >
                <div className="aspect-video overflow-hidden bg-[#522870]">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt={p.imageAlt || p.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <img src={lotusAsset.url} alt="" className="h-12 w-12 opacity-80" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.1)] px-2.5 py-0.5 text-[11px] font-medium text-[#d4a5f9]">
                      {filCategoryLabel(p.category, l)}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[#d4c4e0]/60">
                      <CalendarDays className="h-3 w-3" />
                      {formatFilDate(p.date, l)}
                    </span>
                  </div>
                  <h2 className="mb-2 line-clamp-2 text-base font-bold leading-snug text-white transition-colors group-hover:text-[#d4a5f9]">
                    {p.title}
                  </h2>
                  <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-[#d4c4e0]">{p.excerpt}</p>
                  <div className="mt-4 flex items-center gap-1 text-sm font-semibold text-[#b86ef9] transition-colors group-hover:text-[#d4a5f9]">
                    {copy.discover}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
