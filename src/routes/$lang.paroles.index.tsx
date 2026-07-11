import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listPublishedTherapistArticles } from "@/lib/therapist-articles.functions";
import { PublicNav } from "@/components/layout/PublicNav";
import { Footer } from "@/components/layout/Footer";
import { CalendarDays, ArrowRight, Mic } from "lucide-react";
import { hreflangLinks, ogLocale } from "@/lib/seo";

export const Route = createFileRoute("/$lang/paroles/")({
  component: Page,
  head: ({ params }) => {
    const lang = params.lang;
    const titles: Record<string, string> = {
      fr: "Voix d'experts — Paroles de thérapeutes | Holiswiss",
      de: "Expertenstimmen — Beiträge von Therapeuten | Holiswiss",
      it: "Voci di esperti — Contributi dei terapisti | Holiswiss",
      en: "Expert voices — Articles by therapists | Holiswiss",
    };
    const descs: Record<string, string> = {
      fr: "Découvrez les articles rédigés par les thérapeutes Holiswiss : conseils, réflexions, méthodes et retours d'expérience.",
      de: "Artikel von Therapeuten auf Holiswiss: Ratschläge, Reflexionen, Methoden und Erfahrungsberichte.",
      it: "Articoli scritti dai terapisti Holiswiss: consigli, riflessioni, metodi ed esperienze.",
      en: "Articles written by Holiswiss therapists: tips, reflections, methods and experience.",
    };
    const title = titles[lang] ?? titles.fr;
    const description = descs[lang] ?? descs.fr;
    const url = `https://holiswiss.ch/${lang}/paroles`;
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
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/paroles")],
    };
  },
});

function formatDate(iso: string | null, lang: string) {
  if (!iso) return "";
  const locale = { de: "de-CH", it: "it-CH", en: "en-GB" }[lang] ?? "fr-CH";
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

function Page() {
  const { lang } = useParams({ from: "/$lang/paroles/" });
  const { data, isLoading } = useQuery({
    queryKey: ["therapist-articles-public"],
    queryFn: () => listPublishedTherapistArticles(),
  });

  const items = (data ?? []) as any[];

  return (
    <div className="min-h-screen bg-[#14082d] text-white">
      <PublicNav />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#d4a8ff]">
            <Mic className="h-3.5 w-3.5" /> Voix d'experts
          </div>
          <h1 className="mt-4 text-4xl md:text-5xl font-bold leading-tight">
            Paroles de thérapeutes
          </h1>
          <p className="mt-3 text-white/70 text-lg">
            Découvrez les articles rédigés par les thérapeutes de la communauté Holiswiss.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#3d1a5c] overflow-hidden animate-pulse">
              <div className="aspect-video bg-[#522870]" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-3/4 rounded bg-[#522870]" />
                <div className="h-3 w-full rounded bg-[#522870]" />
                <div className="h-3 w-2/3 rounded bg-[#522870]" />
              </div>
            </div>
          ))}
          {!isLoading && items.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-10 text-center text-white/60">
              Aucun article publié pour le moment. Revenez bientôt !
            </div>
          )}
          {items.map((a) => {
            const t = a.therapists;
            const name = t ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : "";
            return (
              <Link
                key={a.id}
                to="/$lang/paroles/$slug"
                params={{ lang, slug: a.slug }}
                className="group rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#1d0d3d] overflow-hidden hover:border-[#b86ef9] transition-colors flex flex-col"
              >
                <div className="aspect-video bg-gradient-to-br from-[#3d1a5c] to-[#1d0d3d] overflow-hidden">
                  {a.image_couverture ? (
                    <img src={a.image_couverture} alt="" loading="lazy" className="h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[#b86ef9]/40">
                      <Mic className="h-10 w-10" />
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <span>{formatDate(a.date_publication, lang)}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold leading-snug group-hover:text-[#d4a8ff] transition-colors line-clamp-2">
                    {a.titre}
                  </h2>
                  {a.extrait && (
                    <p className="mt-2 text-sm text-white/60 line-clamp-3">{a.extrait}</p>
                  )}
                  <div className="mt-4 flex items-center gap-3 pt-4 border-t border-white/10">
                    {t?.photo_url ? (
                      <img src={t.photo_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-[#3d1a5c] flex items-center justify-center text-xs font-semibold text-[#d4a8ff]">
                        {(name[0] ?? "?").toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{name || "Thérapeute"}</div>
                      {t?.city && <div className="text-xs text-white/50 truncate">{t.city}</div>}
                    </div>
                    <ArrowRight className="h-4 w-4 text-[#b86ef9] group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
      <Footer />
    </div>
  );
}