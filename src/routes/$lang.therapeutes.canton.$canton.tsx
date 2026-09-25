import { createFileRoute, Link, useParams, notFound } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { listTherapistsByCanton } from "@/lib/geo-listings.functions";
import { cantonName, isCantonCode, citySlug } from "@/lib/geo-listings";
import { ogLocale, seoLinks, SITE } from "@/lib/seo";
import { TherapistCardCompact } from "@/components/holiswiss/TherapistCardCompact";
import { loadEssential } from "@/lib/read-health";
import { ServiceUnavailableNotice } from "@/components/holiswiss/ServiceUnavailableNotice";
import type { PublicTherapistCard } from "@/lib/geo-listings.functions";

const T = {
  fr: {
    home: "Accueil",
    therapists: "Thérapeutes",
    h1: (c: string) => `Thérapeutes holistiques dans le canton de ${c}`,
    title: (c: string) => `Thérapeutes à ${c} — Annuaire holistique | Holiswiss`,
    desc: (c: string) =>
      `Trouvez un thérapeute holistique dans le canton de ${c} : profils validés par Holiswiss, spécialités, tarifs et prise de rendez-vous en ligne sur Holiswiss.`,
    count: (n: number, c: string) =>
      `${n} ${n > 1 ? "thérapeutes" : "thérapeute"} référencés dans le canton de ${c}`,
    none: (c: string) => `Aucun thérapeute référencé dans le canton de ${c} pour le moment.`,
    cities: "Villes de ce canton",
    all: "Voir tous les thérapeutes en Suisse",
    intro: (c: string) =>
      `Praticiens en médecines complémentaires et accompagnement bien-être exerçant dans le canton de ${c}. Chaque profil précise les approches proposées, les langues parlées, les tarifs et les disponibilités.`,
  },
  de: {
    home: "Startseite",
    therapists: "Therapeuten",
    h1: (c: string) => `Ganzheitliche Therapeuten im Kanton ${c}`,
    title: (c: string) => `Therapeuten in ${c} — Ganzheitliches Verzeichnis | Holiswiss`,
    desc: (c: string) =>
      `Finden Sie eine ganzheitliche Fachperson im Kanton ${c}: geprüfte Profile, Spezialitäten, Preise und Online-Terminbuchung auf Holiswiss.`,
    count: (n: number, c: string) => `${n} Therapeut${n > 1 ? "en" : ""} im Kanton ${c}`,
    none: (c: string) => `Noch keine Therapeuten im Kanton ${c} eingetragen.`,
    cities: "Städte in diesem Kanton",
    all: "Alle Therapeuten in der Schweiz",
    intro: (c: string) =>
      `Fachpersonen für Komplementärmedizin und ganzheitliche Begleitung im Kanton ${c}. Jedes Profil zeigt Methoden, Sprachen, Preise und Verfügbarkeiten.`,
  },
  it: {
    home: "Home",
    therapists: "Terapeuti",
    h1: (c: string) => `Terapeuti olistici nel cantone ${c}`,
    title: (c: string) => `Terapeuti a ${c} — Directory olistica | Holiswiss`,
    desc: (c: string) =>
      `Trova un terapeuta olistico nel cantone ${c}: profili convalidati da Holiswiss, specialità, tariffe e prenotazione online su Holiswiss.`,
    count: (n: number, c: string) => `${n} terapeut${n > 1 ? "i" : "a"} nel cantone ${c}`,
    none: (c: string) => `Nessun terapeuta registrato nel cantone ${c} per il momento.`,
    cities: "Città di questo cantone",
    all: "Tutti i terapeuti in Svizzera",
    intro: (c: string) =>
      `Professionisti di medicine complementari e benessere nel cantone ${c}. Ogni profilo indica approcci, lingue, tariffe e disponibilità.`,
  },
  en: {
    home: "Home",
    therapists: "Therapists",
    h1: (c: string) => `Holistic therapists in the canton of ${c}`,
    title: (c: string) => `Therapists in ${c} — Holistic directory | Holiswiss`,
    desc: (c: string) =>
      `Find a holistic therapist in the canton of ${c}: profiles validated by Holiswiss, specialties, prices and online booking on Holiswiss.`,
    count: (n: number, c: string) => `${n} therapist${n > 1 ? "s" : ""} in the canton of ${c}`,
    none: (c: string) => `No therapists listed in the canton of ${c} yet.`,
    cities: "Towns in this canton",
    all: "See all therapists in Switzerland",
    intro: (c: string) =>
      `Complementary medicine and wellbeing practitioners working in the canton of ${c}. Each profile lists approaches, languages, prices and availability.`,
  },
} as const;

function tr(lang: string) {
  return (T as unknown as Record<string, (typeof T)["fr"]>)[lang.slice(0, 2)] ?? T.fr;
}

export const Route = createFileRoute("/$lang/therapeutes/canton/$canton")({
  component: Page,
  loader: async ({ params }) => {
    const code = params.canton.toUpperCase();
    if (!isCantonCode(code)) throw notFound();
    // Panne technique ≠ canton réellement sans praticien : on ne sert plus une
    // liste vide en 200, la réponse SSR devient un vrai 503 réessayable.
    const res = await loadEssential(() => listTherapistsByCanton({ data: { canton: code } }));
    if (!res.ok) return { therapists: [] as PublicTherapistCard[], unavailable: true as const, indexable: true };
    // Décision d'indexation prise ICI, jamais dans `head` (incident du 25/08) :
    // un canton sans aucun praticien n'a rien à indexer — même règle que le
    // gabarit ville et que le sitemap, qui n'annonce que les cantons peuplés.
    return {
      therapists: res.data.therapists,
      unavailable: false as const,
      indexable: res.data.therapists.length > 0,
    };
  },
  head: ({ params, loaderData }) => {
    const lang = params.lang;
    const t = tr(lang);
    const code = params.canton.toUpperCase();
    const name = cantonName(code, lang);
    const title = t.title(name);
    const description = t.desc(name);
    const url = `${SITE}/${lang}/therapeutes/canton/${code}`;
    const list = (loaderData?.therapists ?? []) as Array<{ slug: string | null; first_name: string | null; last_name: string | null }>;
    // En panne : aucun ItemList (un ItemList vide mentirait sur le contenu réel).
    const unavailable = loaderData?.unavailable === true;
    // Défaut sûr : indexable tant que le loader n'a pas explicitement dit le contraire.
    const noindex = loaderData?.indexable === false;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:locale", content: ogLocale(lang) },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(noindex ? [{ name: "robots", content: "noindex,follow" }] : []),
      ],
      links: seoLinks(lang, `/therapeutes/canton/${code}`),
      scripts: unavailable || noindex ? [] : [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: t.home, item: `${SITE}/${lang}` },
              { "@type": "ListItem", position: 2, name: t.therapists, item: `${SITE}/${lang}/therapeutes` },
              { "@type": "ListItem", position: 3, name, item: url },
            ],
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: title,
            numberOfItems: list.length,
            itemListElement: list
              .filter((x) => x.slug)
              .map((x, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim(),
                url: `${SITE}/${lang}/therapeute/${x.slug}`,
              })),
          }),
        },
      ],
    };
  },
});

function Page() {
  const { lang, canton } = useParams({ from: "/$lang/therapeutes/canton/$canton" });
  const { therapists, unavailable } = Route.useLoaderData();
  const t = tr(lang);
  if (unavailable) return <ServiceUnavailableNotice lang={lang} />;
  const code = canton.toUpperCase();
  const name = cantonName(code, lang);

  const cities = [...new Set(therapists.map((x) => (x.city ?? "").trim()).filter(Boolean))].sort();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-white/50">
        <Link to="/$lang" params={{ lang }} className="hover:text-white">{t.home}</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link to="/$lang/therapeutes" params={{ lang }} className="hover:text-white">{t.therapists}</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <span className="text-white">{name}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">{t.h1(name)}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-base">{t.intro(name)}</p>
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">{t.count(therapists.length, name)}</h2>
        {therapists.length === 0 ? (
          <p className="text-sm text-white/60">{t.none(name)}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {therapists.map((x) => (
              <TherapistCardCompact key={x.id} t={x} lang={lang} />
            ))}
          </div>
        )}
      </section>

      {cities.length > 0 && (
        <section className="mt-12 border-t border-white/10 pt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#b86ef9]">{t.cities}</h2>
          <div className="flex flex-wrap gap-2">
            {cities.map((c) => (
              <Link
                key={c}
                to="/$lang/therapeutes/ville/$citySlug"
                params={{ lang, citySlug: citySlug(c) }}
                className="rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] px-4 py-2 text-sm text-white hover:border-[#b86ef9] hover:bg-[rgba(184,110,249,0.2)]"
              >
                {c}
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-sm">
        <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#5cc8fa] hover:underline">
          {t.all}
        </Link>
      </p>
    </div>
  );
}
