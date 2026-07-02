import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getFamilyPage, pickI18n } from "@/lib/specialties.functions";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { ChevronRight, MapPin } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";

export const Route = createFileRoute("/$lang/therapeutes/famille/$familySlug")({
  component: Page,
  head: ({ params }) => {
    const url = `https://holiswiss.ch/${params.lang}/therapeutes/famille/${params.familySlug}`;
    const title = `Thérapeutes — ${params.familySlug.replace(/-/g, " ")} | Holiswiss`;
    const description = `Découvrez les thérapeutes suisses de la famille ${params.familySlug.replace(/-/g, " ")} : spécialités, approches et praticiens vérifiés.`;
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
      links: [{ rel: "canonical", href: url }, ...hreflangLinks(`/therapeutes/famille/${params.familySlug}`)],
    };
  },
});

function Page() {
  const { lang, familySlug } = useParams({ from: "/$lang/therapeutes/famille/$familySlug" });
  const fetchFamily = useServerFn(getFamilyPage);
  const query = useQuery({
    queryKey: ["family-page", familySlug],
    queryFn: () => fetchFamily({ data: { slug: familySlug } }),
  });

  if (query.isLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center text-white/60">Chargement…</div>;
  }
  if (!query.data) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-white">
        <p>Famille introuvable.</p>
        <Link to="/$lang/therapeutes" params={{ lang }} className="text-[#5cc8fa] underline">Retour à l'annuaire</Link>
      </div>
    );
  }

  const { family, specialties, therapists } = query.data as any;
  const famName = pickI18n(family, lang, "name");
  const famDesc = pickI18n(family, lang, "description");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <nav aria-label="Fil d'Ariane" className="mb-6 flex items-center gap-1 text-xs text-white/50">
        <Link to="/$lang" params={{ lang }} className="hover:text-white">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/$lang/therapeutes" params={{ lang }} className="hover:text-white">Thérapeutes</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-white">{famName}</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">{famName}</h1>
        {famDesc && (
          <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base leading-relaxed">
            {famDesc}
          </p>
        )}
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#b86ef9]">
          Spécialités
        </h2>
        <div className="flex flex-wrap gap-2">
          {specialties.map((s: any) => (
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

      <section>
        <h2 className="mb-4 text-lg font-semibold text-white">
          Thérapeutes ({therapists.length})
        </h2>
        {therapists.length === 0 ? (
          <p className="text-sm text-white/60">Aucun thérapeute référencé pour cette famille pour le moment.</p>
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
    </div>
  );
}