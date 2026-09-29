import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Map as MapIcon, MapPin, Building2 } from "lucide-react";
import { CANTONS } from "@/lib/constants";
import type { HomeCityLink } from "@/lib/home-links";

/**
 * « Holiswiss dans toute la Suisse » — les 26 cantons en liens cliquables
 * vers l'annuaire filtré, et les villes dont la page est indexable.
 *
 * Tout vient du loader de l'accueil (`getHomeDirectoryLinks`), donc du HTML
 * serveur : compteurs compris (ils s'hydrataient auparavant côté navigateur).
 *
 * Villes : seules celles qui atteignent le seuil d'indexabilité (2 fiches,
 * `isHomeCityIndexable`) sont liées. La liste se met à jour d'elle-même : une
 * ville qui passe à 2 fiches apparaît, sans modification du code. Elles
 * remplacent les 7 villes écrites en dur dans le pied de page, dont 6 pages à
 * 0 ou 1 fiche.
 */
export function CantonDirectory({
  counts,
  cities,
}: {
  counts: Record<string, number> | null;
  cities: ReadonlyArray<HomeCityLink>;
}) {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });

  return (
    <section className="bg-[#241040]/60">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-white">
          <MapIcon className="h-5 w-5 text-[#b86ef9]" aria-hidden />
          <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            {t("home.cantons.title", "Holiswiss dans toute la Suisse")}
          </h2>
        </div>
        <p className="mt-1 text-sm text-white/65">
          {t("home.cantons.subtitle", "Choisissez votre canton pour trouver un thérapeute près de chez vous")}
        </p>

        {cities.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b9a7d6]">
              {t("homeLinks.cities_title")}
            </h3>
            <ul className="mt-3 flex flex-wrap gap-2.5">
              {cities.map((c) => (
                <li key={c.slug}>
                  <Link
                    to="/$lang/therapeutes/ville/$citySlug"
                    params={{ lang, citySlug: c.slug }}
                    className="group inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#5cc8fa]/35 bg-[#5cc8fa]/[0.07] px-3.5 py-2 text-sm text-white transition hover:border-[#5cc8fa]/80 hover:bg-[#5cc8fa]/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5cc8fa]"
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-[#5cc8fa]" aria-hidden />
                    <span>{t("homeLinks.city_link", { name: c.name })}</span>
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-1.5 text-[11px] font-bold text-white">
                      {c.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-[#b9a7d6]">
              {t("homeLinks.cantons_title")}
            </h3>
          </div>
        )}

        <ul className={`${cities.length > 0 ? "mt-3" : "mt-8"} grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`}>
          {CANTONS.map((canton) => {
            const count = counts?.[canton.code] ?? 0;
            return (
              <li key={canton.code}>
                <Link
                  to="/$lang/therapeutes/canton/$canton"
                  params={{ lang, canton: canton.code }}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-[rgba(184,110,249,0.2)] bg-[#2d1248]/60 px-3.5 py-2.5 text-sm text-white/85 transition hover:border-[#b86ef9]/70 hover:bg-[#3d1a5c]/70"
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-[#b86ef9]/70 transition group-hover:text-[#b86ef9]" aria-hidden />
                    <span className="truncate">{canton.name}</span>
                  </span>
                  {count > 0 && (
                    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-1.5 text-[11px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
