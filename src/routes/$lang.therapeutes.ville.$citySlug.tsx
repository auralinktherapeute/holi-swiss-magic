import { createFileRoute, Link, redirect, useParams } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { listTherapistsByCity } from "@/lib/geo-listings.functions";
import { cantonName } from "@/lib/geo-listings";
import { ogLocale, seoLinks, SITE } from "@/lib/seo";
import { TherapistCardCompact } from "@/components/holiswiss/TherapistCardCompact";
import { loadEssential } from "@/lib/read-health";
import { ServiceUnavailableNotice } from "@/components/holiswiss/ServiceUnavailableNotice";
import { ListingFactsBlock } from "@/components/holiswiss/DirectoryFacts";
import type { PublicTherapistCard } from "@/lib/geo-listings.functions";
import { LastUpdated } from "@/components/holiswiss/LastUpdated";
import { WEBSITE_ID } from "@/lib/organization-schema";
import { isCityIndexable } from "@/lib/seo-thresholds";
import i18n, { DEFAULT_LANG, isLang } from "@/lib/i18n";
import { buildLocalFaqSection, localFaqJsonLd, type LocalFaqSection } from "@/lib/local-faq";
import { LocalFaq } from "@/components/holiswiss/LocalFaq";

const T = {
  fr: {
    home: "Accueil",
    therapists: "Thérapeutes",
    h1: (c: string) => `Thérapeutes holistiques à ${c}`,
    title: (c: string) => `Thérapeutes à ${c} | Holiswiss`,
    desc: (c: string) =>
      `Thérapeutes holistiques à ${c} : profils validés par Holiswiss, spécialités, tarifs et prise de rendez-vous en ligne sur Holiswiss.`,
    // Lieu en apposition (tiret), jamais après « à » : le nom est un texte libre
    // (« Le Grand Saconnex » → « à Le Grand Saconnex »). Voir local-faq.ts.
    count: (n: number, c: string) => `${n} ${n > 1 ? "profils de thérapeutes" : "profil de thérapeute"} — ${c}`,
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
      `Ganzheitliche Therapeuten in ${c}: von Holiswiss geprüfte Profile, Spezialitäten, Preise und Online-Terminbuchung auf Holiswiss.`,
    count: (n: number, c: string) => `${n} Therapeutenprofil${n > 1 ? "e" : ""} — ${c}`,
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
      `Terapeuti olistici a ${c}: profili convalidati da Holiswiss, specialità, tariffe e prenotazione online su Holiswiss.`,
    count: (n: number, c: string) => `${n} ${n > 1 ? "profili di terapeuti" : "profilo di terapeuta"} — ${c}`,
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
      `Holistic therapists in ${c}: profiles validated by Holiswiss, specialties, prices and online booking on Holiswiss.`,
    count: (n: number, c: string) => `${n} therapist profile${n > 1 ? "s" : ""} — ${c}`,
    none: (c: string) => `No therapists listed in ${c} yet.`,
    intro: (c: string) =>
      `Complementary medicine and wellbeing practitioners working in ${c}. Each profile lists approaches, languages, prices and availability.`,
    canton: "Whole canton",
    all: "See all therapists in Switzerland",
  },
} as const;

function tr(lang: string) {
  return (T as unknown as Record<string, (typeof T)["fr"]>)[lang.slice(0, 2)] ?? T.fr;
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
    const res = await loadEssential(() => listTherapistsByCity({ data: { citySlug: params.citySlug } }));
    if (!res.ok) {
      return {
        therapists: [] as PublicTherapistCard[],
        cityName: null,
        canton: null,
        asOf: null,
        lastModified: null,
        localFaq: null as LocalFaqSection | null,
        unavailable: true as const,
        // Panne ≠ page mince : pas de noindex sur un 503 (voir `loadEssential`).
        indexable: true,
      };
    }
    // Alias ou ancien nom de ville → URL canonique (cities.slug), en 301 :
    // /ville/bienne → /ville/biel-bienne, /ville/ge → /ville/geneve. Même règle
    // que le sitemap, qui ne publie que la forme canonique.
    const { canonicalSlug, specialtyLinks, ...rest } = res.data;
    if (canonicalSlug && canonicalSlug !== params.citySlug) {
      throw redirect({
        to: "/$lang/therapeutes/ville/$citySlug",
        params: { lang: params.lang, citySlug: canonicalSlug },
        statusCode: 301,
      });
    }
    // Décision d'indexation prise ICI, jamais dans `head` (incident du 25/08,
    // `seo-thresholds.ts`). Même helper que le sitemap : une ville sous le seuil
    // (0 ou 1 fiche depuis le 29/09/2026) est `noindex,follow` ET absente du
    // sitemap. Calculée APRÈS la redirection d'alias : seule l'URL canonique
    // porte une décision.
    const indexable = isCityIndexable(rest.therapists.length);
    // FAQ locale : calculée UNE fois ici, depuis la liste affichée, puis reprise
    // telle quelle par le HTML et par le JSON-LD FAQPage du `head`. Jamais sur
    // une page noindex (sous le seuil) : ni section, ni FAQPage.
    const lang = isLang(params.lang) ? params.lang : DEFAULT_LANG;
    const localFaq = indexable
      ? buildLocalFaqSection(
          rest.therapists,
          {
            kind: "city",
            place: rest.cityName ?? titleCase(params.citySlug),
            lang,
            specialtyLinks,
          },
          i18n.getFixedT(lang) as unknown as (key: string, vars?: Record<string, unknown>) => string,
        )
      : null;
    return {
      ...rest,
      localFaq,
      unavailable: false as const,
      indexable,
    };
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
    // Panne : ni noindex ni ItemList vide. Le noindex relit la décision du
    // loader ; défaut sûr = indexable tant qu'il n'a pas dit le contraire.
    const unavailable = loaderData?.unavailable === true;
    const noindex = !unavailable && loaderData?.indexable === false;
    const modified = loaderData?.lastModified ?? null;
    const faqLd =
      noindex || unavailable || !loaderData?.localFaq
        ? null
        : localFaqJsonLd(loaderData.localFaq.items, { url, lang, pageId: `${url}#webpage` });
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
        // Ville sous le seuil (`isCityIndexable`) : hors index, liens suivis.
        ...(noindex ? [{ name: "robots", content: "noindex,follow" }] : []),
      ],
      links: seoLinks(lang, `/therapeutes/ville/${params.citySlug}`),
      scripts: noindex || unavailable
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
                "@id": `${url}#itemlist`,
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
            {
              // La page elle-même : porte `dateModified` (invalide sur ItemList),
              // égal au « Mis à jour le » visible — mêmes fiches, même instant.
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "@id": `${url}#webpage`,
                url,
                name: title,
                description,
                inLanguage: lang,
                isPartOf: { "@id": WEBSITE_ID },
                mainEntity: { "@id": `${url}#itemlist` },
                ...(modified ? { dateModified: modified.iso } : {}),
              }),
            },
            // Un seul FAQPage par page, texte identique à la section visible.
            ...(faqLd ? [{ type: "application/ld+json", children: JSON.stringify(faqLd) }] : []),
          ],
    };
  },
});

function Page() {
  const { lang, citySlug: slug } = useParams({ from: "/$lang/therapeutes/ville/$citySlug" });
  const { therapists, cityName, canton, asOf, lastModified, localFaq, unavailable } = Route.useLoaderData();
  const t = tr(lang);
  if (unavailable) return <ServiceUnavailableNotice lang={lang} />;
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
        <LastUpdated modified={lastModified} lang={lang} className="mt-2" />
      </header>

      <ListingFactsBlock rows={therapists} asOf={asOf} scope={{ kind: "city", name }} />

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

      <LocalFaq faq={localFaq} />

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
