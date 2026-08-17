import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { getPublishedNewsletterBySlug } from "@/lib/newsletter.functions";
import { hreflangLinks, ogLocale } from "@/lib/seo";

export const Route = createFileRoute("/$lang/lettre/$slug")({
  component: Page,
  head: ({ params }) => {
    const title = "La Lettre Holiswiss — ressource pour thérapeutes";
    const description =
      "Ressource pratique de La Lettre Holiswiss : visibilité, organisation du cabinet et accompagnement numérique des thérapeutes en Suisse.";
    const url = `https://holiswiss.ch/${params.lang}/lettre/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:locale", content: ogLocale(params.lang) },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks(`/lettre/${params.slug}`)],
    };
  },
});

type PublicIssue = {
  resource_title: string | null;
  resource_intro: string | null;
  resource_body: string | null;
  resource_sections: string | null;
  resource_example: string | null;
  resource_checklist: string | null;
  resource_takeaway: string | null;
  resource_cta: string | null;
  published_at: string | null;
};

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  const locale = { de: "de-CH", it: "it-CH", en: "en-GB" }[lang] ?? "fr-CH";
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Paragraphs({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <>
      {text.split(/\n{2,}/).map((block, i) => (
        <p key={i} className="text-white/75 leading-relaxed whitespace-pre-line">
          {block}
        </p>
      ))}
    </>
  );
}

function Page() {
  const { lang, slug } = useParams({ from: "/$lang/lettre/$slug" });
  const { data, isLoading } = useQuery({
    queryKey: ["newsletter-resource", slug],
    queryFn: () => getPublishedNewsletterBySlug({ data: { slug } }),
  });

  const issue = (data?.issue ?? null) as PublicIssue | null;
  const checklist = (issue?.resource_checklist ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-[#14082d] text-white">
      <article className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {isLoading && (
          <div className="space-y-4 animate-pulse" aria-busy="true">
            <div className="h-10 w-3/4 rounded bg-[#3d1a5c]" />
            <div className="h-4 w-1/3 rounded bg-[#3d1a5c]" />
            <div className="h-40 rounded-2xl bg-[#3d1a5c]" />
          </div>
        )}

        {!isLoading && !issue && (
          <p className="py-16 text-center text-white/60">
            Cette ressource n'est pas disponible.
          </p>
        )}

        {issue && (
          <>
            <header className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#d4a8ff]">
                La Lettre Holiswiss
              </p>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                {issue.resource_title}
              </h1>
              {issue.published_at && (
                <p className="inline-flex items-center gap-1.5 text-sm text-white/55">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {formatDate(issue.published_at, lang)}
                </p>
              )}
            </header>

            {issue.resource_intro && (
              <p className="text-lg text-white/85 leading-relaxed whitespace-pre-line">
                {issue.resource_intro}
              </p>
            )}

            <div className="space-y-4">
              <Paragraphs text={issue.resource_body} />
            </div>

            {issue.resource_sections && (
              <div className="space-y-4">
                <Paragraphs text={issue.resource_sections} />
              </div>
            )}

            {issue.resource_example && (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
                <h2 className="text-lg font-semibold">Exemple concret</h2>
                <Paragraphs text={issue.resource_example} />
              </section>
            )}

            {checklist.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold">Checklist</h2>
                <ul className="space-y-2">
                  {checklist.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-white/75">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-[#4ade80]"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {issue.resource_takeaway && (
              <section className="rounded-2xl border border-[#b86ef9]/30 bg-[#b86ef9]/10 p-5 space-y-2">
                <h2 className="text-lg font-semibold">À retenir</h2>
                <Paragraphs text={issue.resource_takeaway} />
              </section>
            )}

            {issue.resource_cta && (
              <p className="pt-2 text-lg font-semibold text-[#d4a8ff]">{issue.resource_cta}</p>
            )}
          </>
        )}
      </article>
    </div>
  );
}
