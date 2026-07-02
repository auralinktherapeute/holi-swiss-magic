import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSpecialtyCityPage, pickI18n } from "@/lib/specialties.functions";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { ChevronRight, MapPin } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import { useEffect } from "react";

function humanCity(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const Route = createFileRoute("/$lang/specialites/$specialtySlug/$citySlug")({
  component: Page,
  head: ({ params }) => {
    const url = `https://holiswiss.ch/${params.lang}/specialites/${params.specialtySlug}/${params.citySlug}`;
    const label = params.specialtySlug.replace(/-/g, " ");
    const city = humanCity(params.citySlug);
    const title = `${label.replace(/\b\w/g, (c) => c.toUpperCase())} à ${city} — Holiswiss`;
    const description = `Trouvez un praticien de ${label} à ${city} : profils vérifiés, tarifs, prise de rendez-vous en ligne.`;
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
      links: [{ rel: "canonical", href: url }, ...hreflangLinks(`/specialites/${params.specialtySlug}/${params.citySlug}`)],
    };
  },
});

function Page() {
  const { lang, specialtySlug, citySlug } = useParams({ from: "/$lang/specialites/$specialtySlug/$citySlug" });
  const fetchPage = useServerFn(getSpecialtyCityPage);
  const query = useQuery({
    queryKey: ["specialty-city-page", specialtySlug, citySlug],
    queryFn: () => fetchPage({ data: { slug: specialtySlug, city: citySlug.replace(/-/g, " ") } }),
  });

  if (query.isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-white/60">Chargement…</div>;
  }
  if (!query.data || !query.data.specialty) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-white">
        <p>Combinaison introuvable.</p>
        <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#5cc8fa] underline">Retour à l'annuaire</Link>
      </div>
    );
  }

  const { specialty, family, city, therapists } = query.data as any;
  const specName = pickI18n(specialty, lang, "name");
  const specDesc = pickI18n(specialty, lang, "description");
  const cityDisplay = city?.display_name || humanCity(citySlug);
  const shouldIndex = therapists.length > 0;

  // Client-side noindex when the combination has no therapist yet.
  // (Google honors late-injected robots meta on rerender.)
  useEffect(() => {
    if (shouldIndex) return;
    const el = document.createElement("meta");
    el.name = "robots";
    el.content = "noindex,follow";
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [shouldIndex]);

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <nav aria-label="Fil d'Ariane" className="mb-6 flex items-center gap-1 text-xs text-white/50">
          <Link to="/$lang" params={{ lang }} className="hover:text-white">Accueil</Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/$lang/therapeutes" params={{ lang }} className="hover:text-white">Thérapeutes</Link>
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
            params={{ lang, specialtySlug: specialty.slug }}
            className="hover:text-white"
          >
            {specName}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-white">{cityDisplay}</span>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{specName} à {cityDisplay}</h1>
          {specDesc && (
            <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base leading-relaxed">{specDesc}</p>
          )}
        </header>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-white">
            {therapists.length} thérapeute{therapists.length > 1 ? "s" : ""} en {specName} à {cityDisplay}
          </h2>
          {therapists.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#1a0a2e] p-6 text-sm text-white/70">
              Aucun thérapeute référencé en {specName} à {cityDisplay} pour le moment.
              <div className="mt-3">
                <Link
                  to="/$lang/specialites/$specialtySlug"
                  params={{ lang, specialtySlug: specialty.slug }}
                  className="text-[#5cc8fa] underline"
                >
                  Voir tous les praticiens de {specName} en Suisse →
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