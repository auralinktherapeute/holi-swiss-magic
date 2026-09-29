import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Users, MapPin, ArrowRight, BadgeCheck, Info } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import type { TherapistMapTherapist } from "@/components/map/TherapistMap";
import type { HomeTherapist } from "@/lib/home-links";

const TherapistMap = lazy(() =>
  import("@/components/map/TherapistMap").then((m) => ({ default: m.TherapistMap })),
);

/** Fiches listées en détail ; les suivantes restent liées dans « Également ». */
const VISIBLE = 6;

/**
 * Liste + carte des praticiens. Les fiches viennent du loader de l'accueil
 * (`getHomeDirectoryLinks`) : liste et liens sont dans le HTML serveur. Seule la
 * carte reste montée côté navigateur (Leaflet). `therapists = null` : lecture
 * serveur échouée — on n'affiche pas de squelette qui ne se remplirait jamais.
 */
export function NearbyTherapistsSwiss({ therapists: list }: { therapists: ReadonlyArray<HomeTherapist> | null }) {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const therapists = list ?? [];
  const visible = therapists.slice(0, VISIBLE);
  const others = therapists.slice(VISIBLE);
  const mapTherapists = useMemo<TherapistMapTherapist[]>(
    () =>
      (list ?? []).map((th) => ({
        id: th.id,
        slug: th.slug,
        first_name: th.first_name ?? "",
        last_name: th.last_name ?? "",
        title: th.title ?? undefined,
        photo_url: th.photo_url ?? undefined,
        city: th.city ?? undefined,
        canton: th.canton ?? undefined,
        latitude: th.latitude ?? undefined,
        longitude: th.longitude ?? undefined,
        price_min: th.price_min ?? undefined,
        currency: th.currency ?? undefined,
        verified: !!th.verified,
        specialties: th.specialties ?? undefined,
      })),
    [list],
  );

  return (
    <section className="bg-[#1a0a2e]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT: list */}
          <div className="rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#2d1248]/60 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-5 w-5 text-[#b86ef9]" />
              <h2 className="text-xl font-bold sm:text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {t("home.nearby.title", "Thérapeutes à proximité")}
              </h2>
            </div>
            <p className="mt-1 text-sm text-white/65">
              {t("home.nearby.subtitle", "Découvrez quelques praticiens de notre réseau en Suisse")}
            </p>

            {visible.length > 0 && (
              <ul className="mt-5 space-y-3">
                {visible.map((th) => {
                  const initials = `${th.first_name?.[0] ?? ""}${th.last_name?.[0] ?? ""}`.toUpperCase();
                  const fullName = `${th.first_name ?? ""} ${th.last_name ?? ""}`.trim();
                  const isActive = selectedId === th.id;
                  return (
                    <li
                      key={th.id}
                      className={`group flex items-center gap-3 rounded-xl border p-3 transition-all ${
                        isActive
                          ? "border-[#5cc8fa] bg-[#3d1a5c] shadow-[0_0_20px_rgba(92,200,250,0.25)]"
                          : "border-[rgba(184,110,249,0.18)] bg-[#3d1a5c]/40 hover:border-[#b86ef9]/60 hover:bg-[#3d1a5c]/70"
                      }`}
                    >
                      {/* Bouton = sélection sur la carte ; lien = fiche. Deux
                          éléments frères : un lien DANS un bouton est du HTML
                          invalide (et un lien que certains robots ignorent). */}
                      <button
                        type="button"
                        onClick={() => setSelectedId(th.id)}
                        aria-pressed={isActive}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5cc8fa] rounded-lg"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-[#b86ef9]/40 bg-gradient-to-br from-[#3d1a5c] to-[#1a1035]">
                          <TherapistAvatar
                            photoUrl={th.photo_url ?? undefined}
                            alt={fullName || "Thérapeute"}
                            fallback={initials || "?"}
                            fallbackClassName="flex h-full w-full items-center justify-center text-sm font-bold text-[#b86ef9]"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{fullName}</p>
                            {th.verified && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#d4a05a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#f5c97a] ring-1 ring-[#d4a05a]/40">
                                <BadgeCheck className="h-3 w-3" /> {t("home.newest.verified", "Vérifié")}
                              </span>
                            )}
                          </div>
                          {th.city && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
                              <MapPin className="h-3 w-3" /> {th.city}
                            </p>
                          )}
                          {th.title && (
                            <span className="mt-1.5 inline-block rounded-full bg-[#1a1035] px-2 py-0.5 text-[11px] text-[#d4a5f9]">
                              {th.title}
                            </span>
                          )}
                        </div>
                      </button>
                      <Link
                        to="/$lang/therapeute/$slug"
                        params={{ lang: th.profileLang, slug: th.slug }}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[#1a1035] text-[#b86ef9] transition group-hover:border-[#b86ef9] group-hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
                        aria-label={`${t("home.nearby.viewProfile", "Voir le profil")} — ${fullName}`}
                      >
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Les fiches au-delà des six premières restent atteignables en un
                clic depuis l'accueil (et pour les robots, en un saut). */}
            {others.length > 0 && (
              <div className="mt-5 border-t border-[rgba(184,110,249,0.15)] pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b9a7d6]">
                  {t("homeLinks.also_listed")}
                </h3>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {others.map((th) => (
                    <li key={th.id}>
                      <Link
                        to="/$lang/therapeute/$slug"
                        params={{ lang: th.profileLang, slug: th.slug }}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[rgba(184,110,249,0.22)] bg-[rgba(255,255,255,0.06)] px-3 py-1 text-xs text-white/85 transition hover:border-[#b86ef9]/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
                      >
                        <span className="font-medium">
                          {`${th.first_name ?? ""} ${th.last_name ?? ""}`.trim()}
                        </span>
                        {th.city && <span className="text-white/50">· {th.city}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              to="/$lang/therapeutes"
              params={{ lang }}
              className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-[#b86ef9] bg-[#b86ef9]/10 px-4 py-3 text-sm font-semibold text-[#d4a5f9] transition hover:bg-[#b86ef9]/20"
            >
              {t("home.nearby.seeAll", "Voir tous les thérapeutes")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* RIGHT: map */}
          <div className="rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#2d1248]/60 p-5 sm:p-6">
            <div className="flex items-center gap-2 text-white">
              <MapPin className="h-5 w-5 text-[#b86ef9]" />
              <h2 className="text-xl font-bold sm:text-2xl" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                {t("home.nearby.mapTitle", "Carte des thérapeutes")}
              </h2>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-[rgba(184,110,249,0.2)] bg-[#1a1035]/70 p-3 text-xs text-white/70">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5cc8fa]" />
              <p>
                {t("home.nearby.mapHint", "Zoomez ou déplacez la carte pour découvrir les thérapeutes près de chez vous. Cliquez sur un marqueur pour voir les détails.")}
              </p>
            </div>
            <div className="mt-4 h-[520px] w-full overflow-hidden rounded-xl">
              {isClient ? (
                <Suspense
                fallback={
                  <div className="flex h-full w-full items-center justify-center bg-[#0f0a1e]">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b86ef9] border-t-transparent" />
                  </div>
                }
              >
                <TherapistMap
                  therapists={mapTherapists}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  lang={lang}
                />
                </Suspense>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#0f0a1e]">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#b86ef9] border-t-transparent" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
