import { createFileRoute, Link, useParams, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSpecialtyCityPage, pickI18n, specialtySlugForLang } from "@/lib/specialties.functions";
import { LANGS, ogLocale } from "@/lib/seo";
import { ChevronRight, MapPin } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";

function humanCity(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Slug de ville canonique. Doit rester identique à la slugification du sitemap
 * (`cityToSlug` dans sitemap[.]xml.ts), sinon on redirigerait en boucle vers une
 * URL absente du sitemap.
 */
function cityToSlug(c: string) {
  return c
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const T = {
  fr: { home: "Accueil", therapists: "Thérapeutes", loading: "Chargement…", notFound: "Combinaison introuvable.", back: "Retour à l'annuaire", at: "à", inSpec: "en", therapist: "thérapeute", therapistPlural: "thérapeutes", none: "Aucun thérapeute référencé en", forNow: "pour le moment.", seeAll: (n: string) => `Voir tous les praticiens de ${n} en Suisse →`, titleAt: "à", titleSuffix: "— Holiswiss", desc: (l: string, c: string) => `Trouvez un praticien de ${l} à ${c} : profils vérifiés, tarifs, prise de rendez-vous en ligne.` },
  de: { home: "Startseite", therapists: "Therapeuten", loading: "Wird geladen…", notFound: "Kombination nicht gefunden.", back: "Zurück zum Verzeichnis", at: "in", inSpec: "in", therapist: "Therapeut", therapistPlural: "Therapeuten", none: "Noch keine Therapeuten für", forNow: "eingetragen.", seeAll: (n: string) => `Alle ${n}-Fachpersonen in der Schweiz ansehen →`, titleAt: "in", titleSuffix: "— Holiswiss", desc: (l: string, c: string) => `Finden Sie eine Fachperson für ${l} in ${c}: geprüfte Profile, Preise, Online-Buchung.` },
  it: { home: "Home", therapists: "Terapeuti", loading: "Caricamento…", notFound: "Combinazione non trovata.", back: "Torna alla directory", at: "a", inSpec: "in", therapist: "terapeuta", therapistPlural: "terapeuti", none: "Nessun terapeuta registrato in", forNow: "per il momento.", seeAll: (n: string) => `Vedi tutti i professionisti di ${n} in Svizzera →`, titleAt: "a", titleSuffix: "— Holiswiss", desc: (l: string, c: string) => `Trova un professionista di ${l} a ${c}: profili verificati, tariffe, prenotazione online.` },
  en: { home: "Home", therapists: "Therapists", loading: "Loading…", notFound: "Combination not found.", back: "Back to directory", at: "in", inSpec: "in", therapist: "therapist", therapistPlural: "therapists", none: "No therapists listed in", forNow: "yet.", seeAll: (n: string) => `See all ${n} practitioners in Switzerland →`, titleAt: "in", titleSuffix: "— Holiswiss", desc: (l: string, c: string) => `Find a ${l} practitioner in ${c}: verified profiles, prices, online booking.` },
} as const;
function tr(lang: string) { return (T as any)[lang] ?? T.fr; }

export const Route = createFileRoute("/$lang/specialites/$specialtySlug/$citySlug")({
  component: Page,
  // Chargement serveur : le contenu (H1, thérapeutes de la ville) est rendu dès
  // le HTML initial — sinon les crawlers et les IA ne voyaient que « Chargement… ».
  loader: async ({ params }) => {
    let page: any = null;
    try {
      page = await getSpecialtyCityPage({
        data: { slug: params.specialtySlug, city: params.citySlug.replace(/-/g, " ") },
      });
    } catch {
      return { page: null };
    }
    // Même logique que la page spécialité : une seule URL canonique par langue.
    if (page?.specialty) {
      const canonical = specialtySlugForLang(page.specialty, params.lang);
      if (canonical && canonical !== params.specialtySlug) {
        throw redirect({
          to: "/$lang/specialites/$specialtySlug/$citySlug",
          params: { lang: params.lang, specialtySlug: canonical, citySlug: params.citySlug },
        });
      }
    }

    // `resolve_city` est volontairement souple : « ge », « genf » et « geneva »
    // résolvent tous vers Genève. Sans cette redirection, chaque alias devient une
    // page auto-canonique de plus servant exactement le même contenu — c'est ce qui
    // avait laissé les anciennes URL `/ge` vivre en parallèle des `/geneve`.
    const resolved = (page as any)?.city?.canonical_name as string | undefined;
    if (resolved) {
      const canonicalCity = cityToSlug(resolved);
      if (canonicalCity && canonicalCity !== params.citySlug) {
        throw redirect({
          to: "/$lang/specialites/$specialtySlug/$citySlug",
          params: { lang: params.lang, specialtySlug: params.specialtySlug, citySlug: canonicalCity },
          statusCode: 301,
        });
      }
    }
    return { page };
  },
  head: ({ params, loaderData }) => {
    const url = `https://holiswiss.ch/${params.lang}/specialites/${params.specialtySlug}/${params.citySlug}`;
    const specialty = (loaderData as any)?.page?.specialty;
    // Libellé issu du nom traduit, pas du slug (cf. page spécialité).
    const label = specialty
      ? pickI18n(specialty, params.lang)
      : params.specialtySlug.replace(/-/g, " ");
    const city = humanCity(params.citySlug);
    const t = tr(params.lang);
    const title = `${label.replace(/\b\w/g, (c) => c.toUpperCase())} ${t.titleAt} ${city} ${t.titleSuffix}`;
    const description = t.desc(label, city);
    const hreflangs: Array<{ rel: "alternate"; hreflang: string; href: string }> = LANGS.map((l) => ({
      rel: "alternate",
      hreflang: l,
      href: `https://holiswiss.ch/${l}/specialites/${
        specialty ? specialtySlugForLang(specialty, l) : params.specialtySlug
      }/${params.citySlug}`,
    }));
    hreflangs.push({
      rel: "alternate",
      hreflang: "x-default",
      href: `https://holiswiss.ch/fr/specialites/${
        specialty ? specialty.slug : params.specialtySlug
      }/${params.citySlug}`,
    });
    // Indexable seulement si la ville est reconnue ET qu'au moins un praticien y
    // exerce. Cette décision doit être rendue CÔTÉ SERVEUR : elle vivait dans un
    // useEffect, donc absente du HTML initial — Googlebot au premier passage et les
    // crawlers IA (qui n'exécutent pas JS) ne voyaient qu'« index, follow ». D'où des
    // URL comme /specialites/hypnose/gen, au titre vide de sens, laissées indexables.
    const pageData = (loaderData as any)?.page;
    const cityResolved = Boolean(pageData?.city);
    const hasTherapists = ((pageData?.therapists as unknown[]) ?? []).length > 0;
    const indexable = cityResolved && hasTherapists;

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
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangs],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: t.home, item: `https://holiswiss.ch/${params.lang}` },
              { "@type": "ListItem", position: 2, name: t.therapists, item: `https://holiswiss.ch/${params.lang}/therapeutes` },
              {
                "@type": "ListItem",
                position: 3,
                name: label.replace(/\b\w/g, (c) => c.toUpperCase()),
                item: `https://holiswiss.ch/${params.lang}/specialites/${params.specialtySlug}`,
              },
              { "@type": "ListItem", position: 4, name: city, item: url },
            ],
          }),
        },
      ],
    };
  },
});

function Page() {
  const { lang, specialtySlug, citySlug } = useParams({ from: "/$lang/specialites/$specialtySlug/$citySlug" });
  const t = tr(lang);
  const fetchPage = useServerFn(getSpecialtyCityPage);
  const loaderData = Route.useLoaderData();
  const query = useQuery({
    queryKey: ["specialty-city-page", specialtySlug, citySlug],
    queryFn: () => fetchPage({ data: { slug: specialtySlug, city: citySlug.replace(/-/g, " ") } }),
    initialData: loaderData?.page ?? undefined,
  });

  if (query.isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-white/60">{t.loading}</div>;
  }
  if (!query.data || !query.data.specialty) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-white">
        <p>{t.notFound}</p>
        <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#5cc8fa] underline">{t.back}</Link>
      </div>
    );
  }

  const { specialty, family, city, therapists } = query.data as any;
  const specName = pickI18n(specialty, lang, "name");
  const specDesc = pickI18n(specialty, lang, "description");
  const cityDisplay = city?.display_name || humanCity(citySlug);

  // Le `noindex` des combinaisons vides est désormais émis par `head` (rendu
  // serveur). L'injection client qui vivait ici arrivait après le HTML initial :
  // invisible pour Googlebot au premier passage et pour les crawlers IA.

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <nav aria-label="breadcrumb" className="mb-6 flex items-center gap-1 text-xs text-white/50">
          <Link to="/$lang" params={{ lang }} className="hover:text-white">{t.home}</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/$lang/therapeutes" params={{ lang }} className="hover:text-white">{t.therapists}</Link>
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
          <Link
            to="/$lang/specialites/$specialtySlug"
            params={{ lang, specialtySlug: specialtySlugForLang(specialty, lang) }}
            className="hover:text-white"
          >
            {specName}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white">{cityDisplay}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{specName} {t.at} {cityDisplay}</h1>
          {specDesc && (
            <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base leading-relaxed">{specDesc}</p>
          )}
        </header>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            {therapists.length} {therapists.length > 1 ? t.therapistPlural : t.therapist} {t.inSpec} {specName} {t.at} {cityDisplay}
          </h2>
          {therapists.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#1a0a2e] p-6 text-sm text-white/70">
              {t.none} {specName} {t.at} {cityDisplay} {t.forNow}
              <div className="mt-3">
                <Link
                  to="/$lang/specialites/$specialtySlug"
                  params={{ lang, specialtySlug: specialtySlugForLang(specialty, lang) }}
                  className="text-[#5cc8fa] underline"
                >
                  {t.seeAll(specName)}
                </Link>
              </div>
            </div>
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
                      <TherapistAvatar photoUrl={t.photo_url} alt={`${t.first_name} ${t.last_name}`} fallback={t.first_name?.[0] ?? "?"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{t.first_name} {t.last_name}</p>
                      {t.title && <p className="truncate text-xs text-[#b86ef9]">{t.title}</p>}
                      {t.city && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                          <MapPin className="h-3 w-3" />{t.city}
                          {typeof t.distance_m === "number" && (
                            <span className="ml-2 rounded-full bg-[rgba(92,200,250,0.12)] px-2 py-0.5 text-[10px] text-[#5cc8fa]">
                              {(t.distance_m / 1000).toFixed(t.distance_m < 10000 ? 1 : 0)} km
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}