import { createFileRoute, Link, useParams, redirect, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSpecialtyPage, pickI18n, specialtySlugForLang } from "@/lib/specialties.functions";
import { LANGS, ogLocale } from "@/lib/seo";
import { isSpecialtyIndexable, ownDescription, profileFacts } from "@/lib/seo-thresholds";
import { organizationRef } from "@/lib/organization-schema";
import { ChevronRight, MapPin } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import { ListingFactsBlock } from "@/components/holiswiss/DirectoryFacts";
import { NotFoundPage } from "@/components/layout/NotFoundPage";
import { LastUpdated } from "@/components/holiswiss/LastUpdated";
import { loadEssential } from "@/lib/read-health";
import { ServiceUnavailableNotice } from "@/components/holiswiss/ServiceUnavailableNotice";
import i18n, { DEFAULT_LANG, isLang } from "@/lib/i18n";
import { buildLocalFaqSection, localFaqJsonLd, type LocalFaqSection } from "@/lib/local-faq";
import { LocalFaq } from "@/components/holiswiss/LocalFaq";

const T = {
  fr: {
    home: "Accueil",
    therapists: "Thérapeutes",
    inSwitzerland: "en Suisse",
    loading: "Chargement…",
    notFound: "Spécialité introuvable.",
    back: "Retour à l'annuaire",
    none: "Aucun thérapeute référencé en",
    forNow: "pour le moment.",
    nearby: "Autres spécialités de la même famille",
    listHeading: (n: number, s: string) =>
      `${n} ${n > 1 ? "profils de thérapeutes" : "profil de thérapeute"} — ${s}`,
    titleSuffix: "en Suisse — Annuaire des thérapeutes | Holiswiss",
    desc: (l: string) =>
      `Trouvez un praticien de ${l} en Suisse : profils validés par Holiswiss, tarifs, avis. Prenez rendez-vous en quelques clics.`,
  },
  de: {
    home: "Startseite",
    therapists: "Therapeuten",
    inSwitzerland: "in der Schweiz",
    loading: "Wird geladen…",
    notFound: "Spezialität nicht gefunden.",
    back: "Zurück zum Verzeichnis",
    none: "Noch keine Therapeuten für",
    forNow: "eingetragen.",
    nearby: "Weitere Spezialitäten derselben Familie",
    listHeading: (n: number, s: string) => `${n} Therapeutenprofil${n > 1 ? "e" : ""} — ${s}`,
    titleSuffix: "in der Schweiz — Therapeutenverzeichnis | Holiswiss",
    desc: (l: string) =>
      `Finden Sie eine Fachperson für ${l} in der Schweiz: von Holiswiss geprüfte Profile, Preise, Bewertungen. In wenigen Klicks buchen.`,
  },
  it: {
    home: "Home",
    therapists: "Terapeuti",
    inSwitzerland: "in Svizzera",
    loading: "Caricamento…",
    notFound: "Specialità non trovata.",
    back: "Torna alla directory",
    none: "Nessun terapeuta registrato in",
    forNow: "per il momento.",
    nearby: "Altre specialità della stessa famiglia",
    listHeading: (n: number, s: string) =>
      `${n} ${n > 1 ? "profili di terapeuti" : "profilo di terapeuta"} — ${s}`,
    titleSuffix: "in Svizzera — Elenco dei terapeuti | Holiswiss",
    desc: (l: string) =>
      `Trova un professionista di ${l} in Svizzera: profili convalidati da Holiswiss, tariffe, recensioni. Prenota in pochi clic.`,
  },
  en: {
    home: "Home",
    therapists: "Therapists",
    inSwitzerland: "in Switzerland",
    loading: "Loading…",
    notFound: "Specialty not found.",
    back: "Back to directory",
    none: "No therapists listed in",
    forNow: "yet.",
    nearby: "Other specialties in the same family",
    listHeading: (n: number, s: string) => `${n} therapist profile${n > 1 ? "s" : ""} — ${s}`,
    titleSuffix: "in Switzerland — Therapist directory | Holiswiss",
    desc: (l: string) =>
      `Find a ${l} practitioner in Switzerland: profiles validated by Holiswiss, prices, reviews. Book in a few clicks.`,
  },
} as const;
function tr(lang: string) {
  return (T as any)[lang] ?? T.fr;
}

// Route déclarée en `.index` (et non `$specialtySlug.tsx`) : en routage à plat
// TanStack, `a.$b.tsx` devient le PARENT de `a.$b.$c.tsx`. La page spécialité
// servait donc de layout à la page spécialité × ville, avec deux conséquences
// mesurées en production le 24/08/2026 :
//   1. les deux `head` fusionnaient → DEUX <link rel="canonical"> contradictoires
//      sur chaque page ville (Google les ignore alors tous les deux) ;
//   2. cette page n'ayant pas d'<Outlet/>, la page ville n'était jamais rendue :
//      /fr/specialites/hypnose/geneve affichait le H1 « Hypnose en Suisse ».
// Le suffixe `.index` en refait une feuille : les deux routes deviennent sœurs.
export const Route = createFileRoute("/$lang/specialites/$specialtySlug/")({
  component: Page,
  // Chargement serveur : la page (H1, description, thérapeutes) est rendue dès le HTML initial (SEO/GEO)
  loader: async ({ params }) => {
    // Même contrat que les pages ville, canton et famille : une panne de
    // lecture n'est ni une 404 ni une page mince. `loadEssential` pose le 503
    // (réessayable) et la page ne reçoit AUCUN noindex (indexable: true).
    const res = await loadEssential(() =>
      getSpecialtyPage({ data: { slug: params.specialtySlug } }),
    );
    if (!res.ok)
      return {
        page: null,
        indexable: true,
        localFaq: null as LocalFaqSection | null,
        unavailable: true as const,
      };
    const page = res.data;
    if (!page) throw notFound();
    // La spécialité peut avoir été retrouvée via son slug de base alors qu'un
    // slug localisé existe pour cette langue : rediriger vers l'URL canonique
    // plutôt que de servir le même contenu sous deux adresses.
    if (page?.specialty) {
      const canonical = specialtySlugForLang(page.specialty, params.lang);
      if (canonical && canonical !== params.specialtySlug) {
        throw redirect({
          to: "/$lang/specialites/$specialtySlug",
          params: { lang: params.lang, specialtySlug: canonical },
        });
      }
    }
    // La décision d'indexabilité se prend ICI, jamais dans `head` : le 25/08/2026,
    // une condition posée dans `head` lisait des données absentes à ce niveau et
    // a basculé en noindex TOUTES les pages spécialité × ville, y compris les
    // valides. `head` ne fait plus que relire ce booléen.
    // Seuil unique et partagé avec le sitemap (`seo-thresholds.ts`) : le sitemap
    // ne doit jamais déclarer une page qui émet un noindex.
    // Règle du 07/10/2026 : fiches, diversité de villes et description propre
    // dans la langue de la page. `indexableLangs` : seules ces langues portent
    // des hreflang (jamais vers une variante noindex).
    const facts = profileFacts(page?.therapists ?? []);
    const indexableLangs = LANGS.filter((l) =>
      isSpecialtyIndexable({ ...facts, description: ownDescription(page.specialty, l) }),
    );
    const indexable = isSpecialtyIndexable({
      ...facts,
      description: ownDescription(page.specialty, params.lang),
    });
    // FAQ locale : calculée UNE fois ici, depuis la liste affichée (et le bloc
    // de chiffres), reprise telle quelle par le HTML et le JSON-LD FAQPage.
    // Aucune FAQ sur une page en noindex (sous le seuil) ni en panne.
    const lang = isLang(params.lang) ? params.lang : DEFAULT_LANG;
    const localFaq: LocalFaqSection | null = indexable
      ? buildLocalFaqSection(
          page.therapists,
          { kind: "specialty", place: pickI18n(page.specialty, lang, "name"), lang },
          i18n.getFixedT(lang) as unknown as (
            key: string,
            vars?: Record<string, unknown>,
          ) => string,
        )
      : null;
    return { page, indexable, indexableLangs, localFaq, unavailable: false as const };
  },
  notFoundComponent: () => <NotFoundPage />,
  head: ({ params, loaderData }) => {
    const url = `https://holiswiss.ch/${params.lang}/specialites/${params.specialtySlug}`;
    const t = tr(params.lang);
    const specialty = (loaderData as any)?.page?.specialty;
    // Le libellé vient du nom traduit, jamais du slug : sinon la page allemande
    // de « naturopathie » s'intitulerait « Naturopathie » au lieu de
    // « Naturheilkunde », et ne ressortirait sur aucune requête germanophone.
    const label = specialty
      ? pickI18n(specialty, params.lang)
      : params.specialtySlug.replace(/-/g, " ");
    const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1);
    const title = `${labelCapitalized} ${t.titleSuffix}`;
    const description = t.desc(label);
    const altLangs: readonly string[] = (loaderData as any)?.indexableLangs ?? LANGS;
    const hreflangs: Array<{ rel: "alternate"; hreflang: string; href: string }> = LANGS.filter(
      (l) => altLangs.includes(l),
    ).map((l) => ({
      rel: "alternate",
      hreflang: l,
      href: `https://holiswiss.ch/${l}/specialites/${
        specialty ? specialtySlugForLang(specialty, l) : params.specialtySlug
      }`,
    }));
    if (altLangs.includes("fr"))
      hreflangs.push({
        rel: "alternate",
        hreflang: "x-default",
        href: `https://holiswiss.ch/fr/specialites/${specialty ? specialty.slug : params.specialtySlug}`,
      });
    // `noindex,follow` : la page reste utile au maillage (elle pointe vers les
    // listings et les spécialités sœurs) mais ne prétend plus mériter l'index
    // tant qu'elle n'a personne à montrer. `follow` — pas `none` — pour que le
    // jus de lien continue de circuler. Émis dans le HTML initial, donc lu par
    // les crawlers IA qui ne rendent pas le JavaScript.
    const indexable = (loaderData as any)?.indexable !== false;
    // En panne : ni noindex (voir le loader) ni données structurées.
    const unavailable = (loaderData as any)?.unavailable === true;
    // Page sous le seuil (noindex) : AUCUNE donnée structurée — ni
    // BreadcrumbList, ni CollectionPage/ItemList, ni FAQPage. Même règle que
    // les pages ville, canton et famille (`scripts: unavailable || noindex ? [] …`).
    // Avant le 29/09/2026, une spécialité à 1 praticien, noindex, publiait
    // encore sa CollectionPage et son ItemList.
    const noindex = !unavailable && !indexable;
    // Liste RÉELLE du loader : jamais d'ItemList inventé ni vide.
    const list = (
      ((loaderData as any)?.page?.therapists ?? []) as Array<{
        slug: string | null;
        first_name: string | null;
        last_name: string | null;
      }>
    ).filter((x) => x.slug);
    const localFaq = (loaderData as any)?.localFaq as LocalFaqSection | null | undefined;
    // FAQPage seulement là où la CollectionPage existe (liste non vide) et
    // jamais sur une page noindex. `#page` : @id de la CollectionPage ci-dessous.
    const faqLd =
      indexable && list.length > 0 && localFaq
        ? localFaqJsonLd(localFaq.items, { url, lang: params.lang, pageId: `${url}#page` })
        : null;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(indexable ? [] : [{ name: "robots", content: "noindex,follow" }]),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(params.lang) },
        // Sans ces trois lignes, l'aperçu Twitter/X héritait du titre et de la
        // description FRANÇAIS posés à la racine, dans les quatre langues.
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      // noindex : canonical seule, aucun hreflang (décision du 07/10/2026).
      links: [
        { rel: "canonical", href: url },
        ...(noindex || altLangs.length < 2 ? [] : hreflangs),
      ],
      scripts:
        unavailable || noindex
          ? []
          : [
              {
                type: "application/ld+json",
                children: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "BreadcrumbList",
                  itemListElement: [
                    {
                      "@type": "ListItem",
                      position: 1,
                      name: t.home,
                      item: `https://holiswiss.ch/${params.lang}`,
                    },
                    {
                      "@type": "ListItem",
                      position: 2,
                      name: t.therapists,
                      item: `https://holiswiss.ch/${params.lang}/therapeutes`,
                    },
                    { "@type": "ListItem", position: 3, name: labelCapitalized, item: url },
                  ],
                }),
              },
              ...(list.length === 0
                ? []
                : [
                    {
                      type: "application/ld+json",
                      children: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "CollectionPage",
                        "@id": `${url}#page`,
                        url,
                        name: title,
                        description,
                        inLanguage: params.lang,
                        isPartOf: { "@id": "https://holiswiss.ch/#website" },
                        publisher: organizationRef,
                        // Même valeur que le « Mis à jour le » visible (fiches listées ici).
                        ...((loaderData as any)?.page?.lastModified
                          ? { dateModified: (loaderData as any).page.lastModified.iso }
                          : {}),
                        mainEntity: {
                          "@type": "ItemList",
                          name: title,
                          numberOfItems: list.length,
                          itemListElement: list.map((x, i) => ({
                            "@type": "ListItem",
                            position: i + 1,
                            name: `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim(),
                            url: `https://holiswiss.ch/${params.lang}/therapeute/${x.slug}`,
                          })),
                        },
                      }),
                    },
                  ]),
              // Un seul FAQPage par page, texte identique à la section visible.
              ...(faqLd ? [{ type: "application/ld+json", children: JSON.stringify(faqLd) }] : []),
            ],
    };
  },
});

/** Garde d'indisponibilité : aucun hook de la page n'est appelé en panne. */
function Page() {
  const { lang } = useParams({ from: "/$lang/specialites/$specialtySlug/" });
  const { unavailable } = Route.useLoaderData();
  if (unavailable) return <ServiceUnavailableNotice lang={lang} />;
  return <SpecialtyPage />;
}

function SpecialtyPage() {
  const { lang, specialtySlug } = useParams({ from: "/$lang/specialites/$specialtySlug/" });
  const t = tr(lang);
  const fetchSpec = useServerFn(getSpecialtyPage);
  const loaderData = Route.useLoaderData();
  const query = useQuery({
    queryKey: ["specialty-page", specialtySlug],
    queryFn: () => fetchSpec({ data: { slug: specialtySlug } }),
    initialData: loaderData?.page ?? undefined,
  });

  if (query.isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/60">{t.loading}</div>
    );
  }
  if (!query.data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-white">
        <p>{t.notFound}</p>
        <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#5cc8fa] underline">
          {t.back}
        </Link>
      </div>
    );
  }

  const { specialty, family, siblings, therapists, asOf } = query.data as any;
  // Date lue dans le loader (SSR), comme le `dateModified` du head — pas dans
  // `query.data`, qu'une revalidation client pourrait faire diverger.
  const lastModified = (loaderData as any)?.page?.lastModified ?? null;
  const specName = pickI18n(specialty, lang, "name");
  const specDesc = pickI18n(specialty, lang, "description");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-1 text-xs text-white/50">
        <Link to="/$lang" params={{ lang }} className="hover:text-white">
          {t.home}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/$lang/therapeutes" params={{ lang }} className="hover:text-white">
          {t.therapists}
        </Link>
        {family && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link
              to="/$lang/therapeutes/famille/$familySlug"
              params={{ lang, familySlug: family.slug }}
              className="hover:text-white"
            >
              {pickI18n(family, lang, "name")}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="text-white">{specName}</span>
      </nav>

      <header className="mb-8 min-h-28 sm:min-h-32">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">
          {specName} {t.inSwitzerland}
        </h1>
        {specDesc && (
          <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base leading-relaxed">
            {specDesc}
          </p>
        )}
        <LastUpdated modified={lastModified} lang={lang} className="mt-2" />
      </header>

      <ListingFactsBlock
        rows={therapists}
        asOf={asOf}
        scope={{ kind: "specialty", name: specName }}
        showCantons
        showCities
      />

      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          {t.listHeading(therapists.length, specName)}
        </h2>
        {therapists.length === 0 ? (
          <p className="text-sm text-white/60">
            {t.none} {specName} {t.forNow}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {therapists.map((t: any) => (
              <Link
                key={t.id}
                to="/$lang/therapeute/$slug"
                params={{ lang, slug: t.slug }}
                className="group rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#1a0a2e] p-4 transition hover:border-[#b86ef9] hover:shadow-[0_4px_20px_rgba(184,110,249,0.15)]"
              >
                <div className="flex gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-[#b86ef9]/30">
                    <TherapistAvatar
                      photoUrl={t.photo_url}
                      alt={`${t.first_name} ${t.last_name}`}
                      fallback={t.first_name?.[0] ?? "?"}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">
                      {t.first_name} {t.last_name}
                    </p>
                    {t.title && <p className="truncate text-xs text-[#b86ef9]">{t.title}</p>}
                    {t.city && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                        <MapPin className="h-3 w-3" />
                        {t.city}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <LocalFaq faq={(loaderData as any)?.localFaq ?? null} />

      {siblings.length > 0 && (
        <section className="mt-12 border-t border-white/10 pt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#b86ef9]">
            {t.nearby}
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s: any) => (
              <Link
                key={s.id}
                to="/$lang/specialites/$specialtySlug"
                params={{ lang, specialtySlug: specialtySlugForLang(s, lang) }}
                className="rounded-full border border-[rgba(184,110,249,0.3)] bg-[rgba(184,110,249,0.08)] px-4 py-2 text-sm text-white hover:border-[#b86ef9] hover:bg-[rgba(184,110,249,0.2)]"
              >
                {pickI18n(s, lang, "name")}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
