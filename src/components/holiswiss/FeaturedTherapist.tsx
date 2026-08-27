import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Sparkles, ArrowRight, CalendarDays, FileText, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";

/**
 * « Thérapeute à la Une » — carte signature (proposition B validée).
 * Le thérapeute est sélectionné manuellement depuis le tableau de bord admin
 * (table `featured_therapist`, une seule ligne).
 */

type Featured = {
  id: string; slug: string; first_name: string; last_name: string;
  title: string | null; photo_url: string | null; city: string | null;
  canton: string | null; bio: string | null; verified: boolean | null;
  specialties: string[] | null;
};

type ArticleRow = { id: string; slug: string; titre: string };
type EventRow = { id: string; title: string; event_date: string | null };

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { threshold: 0.05, rootMargin: "0px 0px 10% 0px" },
    );
    io.observe(el);
    const fallback = window.setTimeout(() => setShown(true), 800);
    return () => { io.disconnect(); window.clearTimeout(fallback); };
  }, []);
  return { ref, shown };
}

export function FeaturedTherapist() {
  const { lang } = useParams({ from: "/$lang/" });
  const { ref, shown } = useReveal<HTMLElement>();

  const { data } = useQuery({
    queryKey: ["home-featured-therapist"],
    queryFn: async () => {
      const { data: sel } = await supabase
        .from("featured_therapist")
        .select("therapist_id")
        .eq("id", 1)
        .maybeSingle();
      const id = (sel as { therapist_id: string | null } | null)?.therapist_id;
      if (!id) return null;

      const { data: th } = await supabase
        .from("therapists")
        .select("id, slug, first_name, last_name, title, photo_url, city, canton, bio, verified, specialties")
        .eq("id", id)
        .eq("status", "active")
        .maybeSingle();
      if (!th) return null;

      const today = new Date().toISOString().slice(0, 10);
      const [{ data: articles }, { data: events }] = await Promise.all([
        supabase
          .from("therapist_articles")
          .select("id, slug, titre")
          .eq("therapist_id", id)
          .eq("statut", "publie")
          .order("date_publication", { ascending: false })
          .limit(3),
        supabase
          .from("events")
          .select("id, title, event_date")
          .eq("therapist_id", id)
          .eq("status", "published")
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(2),
      ]);

      return {
        therapist: th as Featured,
        articles: (articles ?? []) as ArticleRow[],
        events: (events ?? []) as EventRow[],
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!data?.therapist) return null;
  const th = data.therapist;
  const fullName = `${th.first_name ?? ""} ${th.last_name ?? ""}`.trim();
  const initials = `${th.first_name?.[0] ?? ""}${th.last_name?.[0] ?? ""}`.toUpperCase();
  const specialties = (th.specialties ?? []).slice(0, 5);

  return (
    <section ref={ref} aria-labelledby="featured-therapist-title" className="bg-[#0b0716] px-4 py-14 sm:px-6 sm:py-20">
      <div
        className={`mx-auto max-w-4xl transition-all duration-700 ease-out motion-reduce:transition-none ${
          shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#2d1248] via-[#1a1035] to-[#0f0a1e] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl sm:p-9">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#b86ef9]/20 blur-[80px] motion-safe:animate-[pulse_6s_ease-in-out_infinite]"
            aria-hidden="true"
          />
          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-start">
            <div className="mx-auto w-full max-w-[220px] shrink-0">
              <Link
                to="/$lang/therapeute/$slug"
                params={{ lang, slug: th.slug }}
                className="block overflow-hidden rounded-3xl border border-white/12 shadow-[0_18px_45px_rgba(0,0,0,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9]"
                aria-label={`Voir le profil de ${fullName}`}
              >
                <div className="aspect-[4/5] w-full bg-gradient-to-br from-[#3d1a5c] to-[#1a1035]">
                  <TherapistAvatar
                    photoUrl={th.photo_url ?? undefined}
                    alt={`Portrait de ${fullName}`}
                    fallback={initials || "?"}
                    fallbackClassName="flex h-full w-full items-center justify-center text-4xl font-bold text-[#b86ef9]"
                  />
                </div>
              </Link>
            </div>

            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#b86ef9]/40 bg-[#b86ef9]/12 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e2c6ff] backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-[#f5c97a] animate-[pulse_3s_ease-in-out_infinite] motion-reduce:animate-none" aria-hidden="true" />
                Thérapeute à la Une
              </span>
              <h2 id="featured-therapist-title" className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
                {fullName}
              </h2>
              {th.title && <p className="mt-1.5 text-sm text-[#d4a5f9]">{th.title}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#c0b0d8]">
                {(th.city || th.canton) && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {[th.city, th.canton].filter(Boolean).join(" · ")}
                  </span>
                )}
                {th.verified && (
                  <span className="inline-flex items-center gap-1.5 text-[#7de3b8]">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Profil vérifié
                  </span>
                )}
              </div>
              {th.bio && (
                <p className="mt-4 line-clamp-4 text-[15px] leading-relaxed text-[#e6dcf2]">{th.bio}</p>
              )}
              {specialties.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {specialties.map((s) => (
                    <li
                      key={s}
                      className="rounded-full border border-[rgba(184,110,249,0.28)] bg-[#b86ef9]/10 px-3 py-1 text-xs font-medium text-[#e2c6ff]"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {(data.articles.length > 0 || data.events.length > 0) && (
            <div className="relative mt-8 grid gap-3 sm:grid-cols-2">
              {data.articles.length > 0 && (
                <ul className="space-y-2" aria-label="Derniers articles">
                  {data.articles.map((a) => (
                    <li key={a.id}>
                      <Link
                        to="/$lang/paroles/$slug"
                        params={{ lang, slug: a.slug }}
                        className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#e6dcf2] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#b86ef9]/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] motion-reduce:transform-none"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-[#d4a5f9]" aria-hidden="true" />
                        <span className="min-w-0">{a.titre}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {data.events.length > 0 && (
                <ul className="space-y-2" aria-label="Événements à venir">
                  {data.events.map((e) => (
                    <li key={e.id}>
                      <Link
                        to="/$lang/evenements/$id"
                        params={{ lang, id: e.id }}
                        className="flex min-h-[44px] items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-[#e6dcf2] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#5cc8fa]/40 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5cc8fa] motion-reduce:transform-none"
                      >
                        <CalendarDays className="h-4 w-4 shrink-0 text-[#5cc8fa]" aria-hidden="true" />
                        <span className="min-w-0">
                          {e.title}
                          {e.event_date && (
                            <> — <span className="text-[#c0b0d8]">
                              {new Date(e.event_date).toLocaleDateString("fr-CH", { day: "numeric", month: "long" })}
                            </span></>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="relative mt-8 flex justify-center">
            <Link
              to="/$lang/therapeute/$slug"
              params={{ lang, slug: th.slug }}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#b86ef9] to-[#8b5cf6] px-7 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(184,110,249,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_38px_rgba(184,110,249,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a5f9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0716] motion-reduce:transform-none"
            >
              Découvrir le profil de {th.first_name}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
