import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { MapPin, BadgeCheck, Languages, ArrowRight, CalendarCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";

type Therapist = {
  id: string; slug: string; first_name: string; last_name: string;
  title?: string | null; photo_url?: string | null; city?: string | null;
  canton?: string | null; languages?: string[] | null; verified?: boolean;
  specialties?: string[] | null; created_at?: string;
};

/**
 * « Nouveaux thérapeutes » — de vrais praticiens visibles dès la homepage :
 * grande photo, spécialité, canton, langues, badge vérifié et CTA rendez-vous.
 */
export function NewTherapistsShowcase() {
  const { t } = useTranslation();
  const { lang } = useParams({ from: "/$lang/" });

  const { data } = useQuery({
    queryKey: ["home-new-therapists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("therapists")
        .select("id,slug,first_name,last_name,title,photo_url,city,canton,languages,verified,specialties,created_at")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Therapist[];
    },
  });

  const therapists = data ?? [];
  if (therapists.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-white">
        <Sparkles className="h-5 w-5 text-[#b86ef9]" aria-hidden />
        <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          {t("home.newest.title", "Nouveaux thérapeutes")}
        </h2>
      </div>
      <p className="mt-1 text-sm text-white/65">
        {t("home.newest.subtitle", "Ils viennent de rejoindre le réseau Holiswiss")}
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {therapists.map((th) => {
          const initials = `${th.first_name?.[0] ?? ""}${th.last_name?.[0] ?? ""}`.toUpperCase();
          const languages = (th.languages ?? []).slice(0, 3);
          const specialty = th.title || (th.specialties ?? [])[0];
          return (
            <article
              key={th.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-[rgba(184,110,249,0.2)] bg-[#2d1248]/70 transition hover:border-[#b86ef9]/60 hover:shadow-[0_0_28px_rgba(184,110,249,0.25)]"
            >
              <Link
                to="/$lang/therapeute/$slug"
                params={{ lang, slug: th.slug }}
                className="relative block aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#3d1a5c] to-[#1a1035]"
                aria-label={`${th.first_name} ${th.last_name}`}
              >
                <TherapistAvatar
                  photoUrl={th.photo_url ?? undefined}
                  alt={`${th.first_name ?? ""} ${th.last_name ?? ""}`.trim() || "Thérapeute"}
                  fallback={initials || "?"}
                  fallbackClassName="flex h-full w-full items-center justify-center text-3xl font-bold text-[#b86ef9]"
                />
                {th.verified && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#1a1035]/90 px-2.5 py-1 text-[11px] font-semibold text-[#f5c97a] ring-1 ring-[#d4a05a]/50 backdrop-blur">
                    <BadgeCheck className="h-3.5 w-3.5" /> {t("home.newest.verified", "Vérifié")}
                  </span>
                )}
              </Link>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="text-base font-semibold text-white">
                  {th.first_name} {th.last_name}
                </h3>
                {specialty && (
                  <span className="inline-block w-fit rounded-full bg-[#1a1035] px-2.5 py-0.5 text-[11px] text-[#d4a5f9]">
                    {specialty}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                  {(th.city || th.canton) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {[th.city, th.canton].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {languages.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Languages className="h-3 w-3" aria-hidden />
                      {languages.join(", ")}
                    </span>
                  )}
                </div>

                <div className="mt-auto flex gap-2 pt-3">
                  <Link
                    to="/$lang/therapeute/$slug"
                    params={{ lang, slug: th.slug }}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#b86ef9] px-3 py-2 text-xs font-semibold text-white shadow-md shadow-[#b86ef9]/30 transition hover:bg-[#a855f7]"
                  >
                    <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
                    {t("home.newest.book", "Prendre rendez-vous")}
                  </Link>
                  <Link
                    to="/$lang/therapeute/$slug"
                    params={{ lang, slug: th.slug }}
                    className="inline-flex items-center justify-center rounded-lg border border-[rgba(184,110,249,0.35)] px-3 py-2 text-xs font-semibold text-[#d4a5f9] transition hover:border-[#b86ef9] hover:text-white"
                    aria-label={t("home.newest.profile", "Voir le profil")}
                  >
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
