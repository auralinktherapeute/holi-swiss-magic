import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { listTherapistsByCity } from "@/lib/geo-listings.functions";
import { cantonName } from "@/lib/geo-listings";
import { ogLocale, seoLinks, SITE } from "@/lib/seo";
import { TherapistCardCompact } from "@/components/holiswiss/TherapistCardCompact";

const T = {
  fr: {
    home: "Accueil",
    therapists: "Thérapeutes",
    h1: (c: string) => `Thérapeutes holistiques à ${c}`,
    title: (c: string) => `Thérapeutes à ${c} | Holiswiss`,
    desc: (c: string) =>
      `Thérapeutes holistiques à ${c} : profils vérifiés, spécialités, tarifs et prise de rendez-vous en ligne sur Holiswiss.`,
    count: (n: number, c: string) => `${n} ${n > 1 ? "thérapeutes" : "thérapeute"} à ${c}`,
    none: (c: string) => `Aucun thérapeute référencé à ${c} pour le moment.`,
    intro: (c: string) =>
      `Praticiens en médecines complémentaires et accompagnement bien-être exerçant à ${c}. Chaque profil précise les approches proposées, les langues parlées, les tarifs et les disponibilités.`,
    canton: "Tout le canton",
    all: "Voir tous les thérapeutes en Suisse",
  },
  de: {
    home: "Startseite",
    therapists: "Therapeuten",
    h1: (c: string) => `Ganzheitliche Therapeuten in ${c}`,
    title: (c: string) => `Therapeuten in ${c} | Holiswiss`,
    desc: (c: string) =>
      `Ganzheitliche Therapeuten in ${c}: geprüfte Profile, Spezialitäten, Preise und Online-Terminbuchung auf Holiswiss.`,
    count: (n: number, c: string) => `${n} Therapeut${n > 1 ? "en" : ""} in ${c}`,
    none: (c: string) => `Noch keine Therapeuten in ${c} eingetragen.`,
    intro: (c: string) =>
      `Fachpersonen für Komplementärmedizin und ganzheitliche Begleitung in ${c}. Jedes Profil zeigt Methoden, Sprachen, Preise und Verfügbarkeiten.`,
    canton: "Ganzer Kanton",
    all: "Alle Therapeuten in der Schweiz",
  },
  it: {
    home: "Home",
    therapists: "Terapeuti",
    h1: (c: string) => `Terapeuti olistici a ${c}`,
    title: (c: string) => `Terapeuti a ${c} | Holiswiss`,
    desc: (c: string) =>
      `Terapeuti olistici a ${c}: profili verificati, specialità, tariffe e prenotazione online su Holiswiss.`,
    count: (n: number, c: string) => `${n} terapeut${n > 1 ? "i" : "a"} a ${c}`,
    none: (c: string) => `Nessun terapeuta registrato a ${c} per il momento.`,
    intro: (c: string) =>
      `Professionisti di medicine complementari e benessere a ${c}. Ogni profilo indica approcci, lingue, tariffe e disponibilità.`,
    canton: "Tutto il cantone",
    all: "Tutti i terapeuti in Svizzera",
  },
  en: {
    home: "Home",
    therapists: "Therapists",
    h1: (c: string) => `Holistic therapists in ${c}`,
    title: (c: string) => `Therapists in ${c} | Holiswiss`,
    desc: (c: string) =>
      `Holistic therapists in ${c}: verified profiles, specialties, prices and online booking on Holiswiss.`,
    count: (n: number, c: string) => `${n} therapist${n > 1 ? "s" : ""} in ${c}`,
    none: (c: string) => `No therapists listed in ${c} yet.`,
    intro: (c: string) =>
      `Complementary medicine and wellbeing practitioners working in ${c}. Each profile lists approaches, languages, prices and availability.`,
    canton: "Whole canton",
    all: "See all therapists in Switzerland",
  },
} as const;

function tr(lang: string) {
  return (T as Record<string, (typeof T)["fr"]>)[lang.slice(0, 2)] ?? T.fr;
}

function titleCase(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

export const Route = createFileRoute("/$lang/therapeutes/ville/$citySlug")({
  component: Page,
  loader: async ({ params }) => {
    try {
      const res = await listTherapistsByCity({ data: { citySlug: params.citySlug } });
      return res;
    } catch {
      return { therapists: [], cityName: null, canton: null };
    }
  },
  head: ({ params, loaderData }) => {
    const lang = params.lang;
    const t = tr(lang);
    const name = loaderData?.cityName ?? titleCase(params.citySlug);
    const title = t.title(name);
    const description = t.desc(name);
    const url = `${SITE}/${lang}/therapeutes/ville/${params.citySlug}`;
    const list = (loaderData?.therapists ?? []) as Array<{
      slug: string | null;
      first_name: string | null;
      last_name: string | null;
    }>;
    const empty = list.length === 0;
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
        // Une ville sans praticien n'a rien à indexer : pas de page vide dans l'index.
        ...(empty ? [{ name: "robots", content: "noindex,follow" }] : []),
      ],
      links: seoLinks(lang, `/therapeutes/ville/${params.citySlug}`),
      scripts: empty
        ? []
        : [
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
  const { lang, citySlug: slug } = useParams({ from: "/$lang/therapeutes/ville/$citySlug" });
  const { therapists, cityName, canton } = Route.useLoaderData();
  const t = tr(lang);
  const name = cityName ?? titleCase(slug);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-1 text-xs text-white/50">
        <Link to="/$lang" params={{ lang }} className="hover:text-white">{t.home}</Link>
        <ChevronRight className="h-3 w-3" aria-hidden />
        <Link to="/$lang/therapeutes" params={{ lang }} className="hover:text-white">{t.therapists}</Link>
        {canton && (
          <>
            <ChevronRight className="h-3 w-3" aria-hidden />
            <Link
              to="/$lang/therapeutes/canton/$canton"
              params={{ lang, canton }}
              className="hover:text-white"
            >
              {cantonName(canton, lang)}
            </Link>
          </>
        )}
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

      <p className="mt-10 flex flex-wrap gap-4 text-sm">
        {canton && (
          <Link
            to="/$lang/therapeutes/canton/$canton"
            params={{ lang, canton }}
            className="text-[#5cc8fa] hover:underline"
          >
            {t.canton} — {cantonName(canton, lang)}
          </Link>
        )}
        <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#5cc8fa] hover:underline">
          {t.all}
        </Link>
      </p>
    </div>
  );
}
