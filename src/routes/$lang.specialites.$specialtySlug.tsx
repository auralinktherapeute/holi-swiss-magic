import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSpecialtyPage, pickI18n } from "@/lib/specialties.functions";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { ChevronRight, MapPin } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";

const T = {
  fr: { home: "Accueil", therapists: "Thérapeutes", inSwitzerland: "en Suisse", loading: "Chargement…", notFound: "Spécialité introuvable.", back: "Retour à l'annuaire", therapist: "thérapeute", therapistPlural: "thérapeutes", inSpec: "en", none: "Aucun thérapeute référencé en", forNow: "pour le moment.", nearby: "Spécialités proches", titleSuffix: "en Suisse — Thérapeutes certifiés | Holiswiss", desc: (l: string) => `Trouvez un praticien de ${l} en Suisse : profils vérifiés, tarifs, avis. Prenez rendez-vous en quelques clics.` },
  de: { home: "Startseite", therapists: "Therapeuten", inSwitzerland: "in der Schweiz", loading: "Wird geladen…", notFound: "Spezialität nicht gefunden.", back: "Zurück zum Verzeichnis", therapist: "Therapeut", therapistPlural: "Therapeuten", inSpec: "in", none: "Noch keine Therapeuten für", forNow: "eingetragen.", nearby: "Ähnliche Spezialitäten", titleSuffix: "in der Schweiz — Zertifizierte Therapeuten | Holiswiss", desc: (l: string) => `Finden Sie eine Fachperson für ${l} in der Schweiz: geprüfte Profile, Preise, Bewertungen. In wenigen Klicks buchen.` },
  it: { home: "Home", therapists: "Terapeuti", inSwitzerland: "in Svizzera", loading: "Caricamento…", notFound: "Specialità non trovata.", back: "Torna alla directory", therapist: "terapeuta", therapistPlural: "terapeuti", inSpec: "in", none: "Nessun terapeuta registrato in", forNow: "per il momento.", nearby: "Specialità simili", titleSuffix: "in Svizzera — Terapeuti certificati | Holiswiss", desc: (l: string) => `Trova un professionista di ${l} in Svizzera: profili verificati, tariffe, recensioni. Prenota in pochi clic.` },
  en: { home: "Home", therapists: "Therapists", inSwitzerland: "in Switzerland", loading: "Loading…", notFound: "Specialty not found.", back: "Back to directory", therapist: "therapist", therapistPlural: "therapists", inSpec: "in", none: "No therapists listed in", forNow: "yet.", nearby: "Related specialties", titleSuffix: "in Switzerland — Certified therapists | Holiswiss", desc: (l: string) => `Find a ${l} practitioner in Switzerland: verified profiles, prices, reviews. Book in a few clicks.` },
} as const;
function tr(lang: string) { return (T as any)[lang] ?? T.fr; }

export const Route = createFileRoute("/$lang/specialites/$specialtySlug")({
  component: Page,
  // Chargement serveur : la page (H1, description, thérapeutes) est rendue dès le HTML initial (SEO/GEO)
  loader: async ({ params }) => {
    try {
      return { page: await getSpecialtyPage({ data: { slug: params.specialtySlug } }) };
    } catch {
      return { page: null };
    }
  },
  head: ({ params }) => {
    const url = `https://holiswiss.ch/${params.lang}/specialites/${params.specialtySlug}`;
    const label = params.specialtySlug.replace(/-/g, " ");
    const t = tr(params.lang);
    const labelCapitalized = label.charAt(0).toUpperCase() + label.slice(1);
    const title = `${labelCapitalized} ${t.titleSuffix}`;
    const description = t.desc(label);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(params.lang) },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks(`/specialites/${params.specialtySlug}`)],
    };
  },
});

function Page() {
  const { lang, specialtySlug } = useParams({ from: "/$lang/specialites/$specialtySlug" });
  const t = tr(lang);
  const fetchSpec = useServerFn(getSpecialtyPage);
  const loaderData = Route.useLoaderData();
  const query = useQuery({
    queryKey: ["specialty-page", specialtySlug],
    queryFn: () => fetchSpec({ data: { slug: specialtySlug } }),
    initialData: loaderData?.page ?? undefined,
  });

  if (query.isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-white/60">{t.loading}</div>;
  }
  if (!query.data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-white">
        <p>{t.notFound}</p>
        <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#5cc8fa] underline">{t.back}</Link>
      </div>
    );
  }

  const { specialty, family, siblings, therapists } = query.data as any;
  const specName = pickI18n(specialty, lang, "name");
  const specDesc = pickI18n(specialty, lang, "description");

  return (
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
        <span className="text-white">{specName}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">{specName} {t.inSwitzerland}</h1>
        {specDesc && (
          <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base leading-relaxed">
            {specDesc}
          </p>
        )}
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          {therapists.length} {therapists.length > 1 ? t.therapistPlural : t.therapist} {t.inSpec} {specName}
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
                    <TherapistAvatar photoUrl={t.photo_url} alt={`${t.first_name} ${t.last_name}`} fallback={t.first_name?.[0] ?? "?"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{t.first_name} {t.last_name}</p>
                    {t.title && <p className="truncate text-xs text-[#b86ef9]">{t.title}</p>}
                    {t.city && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-white/50">
                        <MapPin className="h-3 w-3" />{t.city}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

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
                params={{ lang, specialtySlug: s.slug }}
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