import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Users, MapPin, ArrowRight, BadgeCheck, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";

const TherapistMap = lazy(() =>
  import("@/components/map/TherapistMap").then((m) => ({ default: m.TherapistMap })),
);

type Therapist = {
  id: string; slug: string; first_name: string; last_name: string;
  title?: string; photo_url?: string; city?: string; canton?: string;
  latitude?: number; longitude?: number; price_min?: number; currency?: string;
  verified?: boolean; specialties?: string[];
};

export function NearbyTherapistsSwiss() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  const { data } = useQuery({
    queryKey: ["home-nearby-therapists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id,slug,first_name,last_name,title,photo_url,city,canton,latitude,longitude,price_min,currency,verified,specialties")
        .eq("status", "active")
        .order("verified", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Therapist[];
    },
  });

  const therapists = data ?? [];
  const visible = therapists.slice(0, 6);

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

            <ul className="mt-5 space-y-3">
              {visible.length === 0 ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="h-[78px] animate-pulse rounded-xl bg-[#3d1a5c]/50" />
                ))
              ) : (
                visible.map((th) => {
                  const initials = `${th.first_name?.[0] ?? ""}${th.last_name?.[0] ?? ""}`.toUpperCase();
                  const isActive = selectedId === th.id;
                  return (
                    <li key={th.id}>
                      <button
                        onClick={() => setSelectedId(th.id)}
                        className={`group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                          isActive
                            ? "border-[#5cc8fa] bg-[#3d1a5c] shadow-[0_0_20px_rgba(92,200,250,0.25)]"
                            : "border-[rgba(184,110,249,0.18)] bg-[#3d1a5c]/40 hover:border-[#b86ef9]/60 hover:bg-[#3d1a5c]/70"
                        }`}
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-[#b86ef9]/40 bg-gradient-to-br from-[#3d1a5c] to-[#1a1035]">
                          <TherapistAvatar
                            photoUrl={th.photo_url}
                            alt={`${th.first_name ?? ""} ${th.last_name ?? ""}`.trim() || "Thérapeute"}
                            fallback={initials || "?"}
                            fallbackClassName="flex h-full w-full items-center justify-center text-sm font-bold text-[#b86ef9]"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">
                              {th.first_name} {th.last_name}
                            </p>
                            {th.verified && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#d4a05a]/20 px-2 py-0.5 text-[10px] font-semibold text-[#f5c97a] ring-1 ring-[#d4a05a]/40">
                                <BadgeCheck className="h-3 w-3" /> Vérifié
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
                        <Link
                          to="/$lang/therapeute/$slug"
                          params={{ lang, slug: th.slug }}
                          onClick={(e) => e.stopPropagation()}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgba(184,110,249,0.3)] bg-[#1a1035] text-[#b86ef9] transition group-hover:border-[#b86ef9] group-hover:text-white"
                          aria-label={t("home.nearby.viewProfile", "Voir le profil")}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

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
                  therapists={therapists}
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
