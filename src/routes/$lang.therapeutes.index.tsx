import { createFileRoute, Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Star, Zap, BadgeCheck, Map, List, SlidersHorizontal, Search, X } from "lucide-react";
import { TherapistAvatar } from "@/components/holiswiss/TherapistAvatar";
import { useSessionState } from "@/hooks/use-session-state";
import { hreflangLinks, ogLocale } from "@/lib/seo";
import { SpecialtyExplorer } from "@/components/holiswiss/SpecialtyExplorer";

const TherapistMap = lazy(() =>
  import("@/components/map/TherapistMap").then((m) => ({ default: m.TherapistMap }))
);

export const Route = createFileRoute("/$lang/therapeutes/")({
  component: Page,
  validateSearch: (s: Record<string, unknown>) => ({
    specialite: typeof s.specialite === "string" ? s.specialite : undefined,
    famille: typeof s.famille === "string" ? s.famille : undefined,
  }),
  head: ({ params }) => {
    const lang = params.lang;
    const titles: Record<string, string> = {
      fr: "Trouver un thérapeute en Suisse — Holiswiss",
      de: "Therapeuten in der Schweiz finden — Holiswiss",
      it: "Trovare un terapeuta in Svizzera — Holiswiss",
      en: "Find a therapist in Switzerland — Holiswiss",
    };
    const descs: Record<string, string> = {
      fr: "Annuaire des thérapeutes holistiques en Suisse : carte interactive, 26 cantons, filtres par spécialité et langue. Profils vérifiés et avis authentiques.",
      de: "Verzeichnis ganzheitlicher Therapeuten in der Schweiz: interaktive Karte, 26 Kantone, Filter nach Fachgebiet und Sprache. Geprüfte Profile und echte Bewertungen.",
      it: "Elenco dei terapeuti olistici in Svizzera: mappa interattiva, 26 cantoni, filtri per specialità e lingua. Profili verificati e recensioni autentiche.",
      en: "Directory of holistic therapists in Switzerland: interactive map, 26 cantons, filters by specialty and language. Verified profiles and authentic reviews.",
    };
    const title = titles[lang] ?? titles.fr;
    const description = descs[lang] ?? descs.fr;
    const url = `https://holiswiss.ch/${lang}/therapeutes`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { property: "og:locale", content: ogLocale(lang) },
      ],
      links: [{ rel: "canonical", href: url }, ...hreflangLinks("/therapeutes")],
    };
  },
});

type Therapist = {
  id: string; slug: string; first_name: string; last_name: string;
  title?: string; short_bio?: string; photo_url?: string;
  city?: string; canton?: string; latitude?: number; longitude?: number;
  price_min?: number; price_max?: number; currency?: string;
  is_premium?: boolean; verified?: boolean; specialties?: string[];
  distance_m?: number;
  score?: number;
  matched_city?: string | null;
  matched_specialty?: string | null;
};

const CANTON_LABELS: Record<string, string> = {
  GE: "Genève", VD: "Vaud", VS: "Valais", FR: "Fribourg", NE: "Neuchâtel",
  JU: "Jura", BE: "Berne", ZH: "Zurich", BS: "Bâle-Ville", AG: "Argovie",
  TI: "Tessin", LU: "Lucerne", SG: "Saint-Gall",
};

function CardSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-[rgba(184,110,249,0.15)] bg-[#1a0a2e] p-4 animate-pulse">
      <div className="h-14 w-14 shrink-0 rounded-full bg-[#3d1a5c]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-[#3d1a5c]" />
        <div className="h-3 w-1/2 rounded bg-[#3d1a5c]" />
        <div className="h-3 w-3/4 rounded bg-[#3d1a5c]" />
      </div>
    </div>
  );
}

function Page() {
  const { lang } = useParams({ from: "/$lang/therapeutes/" });
  const navigate = useNavigate({ from: "/$lang/therapeutes/" });
  const searchParams = useSearch({ from: "/$lang/therapeutes/" });
  const { specialite: specFilter, famille: famFilter } = searchParams;
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useSessionState<string | null>("therapists.selectedId", null);
  const [mobileTab, setMobileTab] = useSessionState<"list" | "map">("therapists.mobileTab", "list");
  const [search, setSearch] = useSessionState("therapists.search", "");
  const [debounced, setDebounced] = useState(search);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(id);
  }, [search]);

  const hasSpecFilter = !!(specFilter || famFilter);

  // ── Unified search RPC: name, city, specialty, tags, bio, aliases
  const searchQuery = useQuery({
    queryKey: ["therapists-search", debounced, specFilter ?? null, famFilter ?? null],
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("search_therapists", {
        _q: debounced.length >= 2 ? debounced : null,
        _spec_slug: specFilter ?? null,
        _family_slug: famFilter ?? null,
        _limit: 100,
      });
      if (error) throw error;
      return (data ?? []) as Therapist[];
    },
  });

  // Label lookup for the active chip
  const activeLabelQuery = useQuery({
    queryKey: ["specialty-label", specFilter ?? null, famFilter ?? null],
    enabled: !!(specFilter || famFilter),
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (specFilter) {
        const { data } = await supabase.from("specialties").select("name_fr").eq("slug", specFilter).maybeSingle();
        return (data as any)?.name_fr ?? specFilter;
      }
      if (famFilter) {
        const { data } = await supabase.from("specialty_families").select("name_fr").eq("slug", famFilter).maybeSingle();
        return (data as any)?.name_fr ?? famFilter;
      }
      return null;
    },
  });

  const isSearching = debounced.length >= 2;
  const isLoading = searchQuery.isLoading;
  const filtered: Therapist[] = searchQuery.data ?? [];
  const matchedCity = filtered[0]?.matched_city ?? null;
  const matchedSpecialty = filtered[0]?.matched_specialty ?? null;
  const cityNotFound = false;

  const setSelection = (sel: { specialite?: string; famille?: string }) => {
    navigate({
      search: (prev: any) => ({ ...prev, specialite: sel.specialite, famille: sel.famille }),
      replace: true,
    });
  };
  const clearFilter = () => setSelection({});

  const handleCardClick = (t: Therapist) => {
    setSelectedId(t.id);
    setMobileTab("map");
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">

      {/* ── Specialty Explorer (4 families + search + all) ── */}
      <div className="border-b border-[rgba(184,110,249,0.15)] bg-[#0f0a1e] px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-5xl">
          <SpecialtyExplorer
            lang={lang}
            active={{ specialite: specFilter, famille: famFilter }}
            onSelect={setSelection}
          />
          {hasSpecFilter && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <span className="text-white/50">Filtre actif :</span>
              <button
                onClick={clearFilter}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#b86ef9] bg-[rgba(184,110,249,0.25)] px-3 py-1 font-medium text-white hover:bg-[rgba(184,110,249,0.4)]"
              >
                {activeLabelQuery.data ?? "…"}
                <X className="h-3 w-3" />
              </button>
              <button
                onClick={clearFilter}
                className="rounded-full border border-white/15 px-3 py-1 text-white/70 hover:border-white/40 hover:text-white"
              >
                Tous les thérapeutes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Header barre ── */}
      <div className="flex items-center gap-3 border-b border-[rgba(184,110,249,0.15)] bg-[#0f0a1e] px-4 py-3">
        <h1 className="sr-only">{t("therapists_directory.h1", "Trouver un thérapeute en Suisse")}</h1>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgba(255,255,255,0.35)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t("therapist_profile.search_placeholder")}
            type="search"
            placeholder={t("therapist_profile.search_placeholder")}
            className="w-full rounded-xl border border-[rgba(184,110,249,0.25)] bg-[rgba(184,110,249,0.06)] py-2 pl-9 pr-4 text-sm text-white placeholder-[rgba(255,255,255,0.6)] outline-none focus:border-[#b86ef9] transition"
          />
        </div>
        <span className="hidden sm:block text-sm text-[rgba(255,255,255,0.45)]">
          {filtered.length} {filtered.length !== 1 ? t("therapist_profile.therapist_plural") : t("therapist_profile.therapist_singular")}
        </span>
        {/* Mobile tabs */}
        <div className="ml-auto flex sm:hidden rounded-xl border border-[rgba(184,110,249,0.25)] overflow-hidden">
          {(["list", "map"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition ${mobileTab === tab ? "bg-[#b86ef9] text-white" : "text-[rgba(255,255,255,0.5)] hover:text-white"}`}
            >
              {tab === "list" ? <List className="h-3.5 w-3.5" /> : <Map className="h-3.5 w-3.5" />}
              {tab === "list" ? "Liste" : "Carte"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Split layout ── */}
      <div className="flex overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

        {/* ── Liste (40%) ── */}
        <div className={`flex flex-col overflow-y-auto bg-[#0f0a1e] ${mobileTab === "map" ? "hidden sm:flex" : "flex"} sm:w-[42%] w-full`}>
          <div className="space-y-2 p-3">
            {isSearching && !isLoading && (
              <div className="px-1 pb-1 text-xs text-[rgba(255,255,255,0.55)]">
                {filtered.length} thérapeute{filtered.length !== 1 ? "s" : ""}
                {matchedSpecialty && <> pour <span className="text-white">{matchedSpecialty}</span></>}
                {matchedCity && <> autour de <span className="text-white">{matchedCity}</span></>}
              </div>
            )}
            {isLoading && Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
            <AnimatePresence>
              {filtered.map((th, i) => {
                const fullName = `${th.first_name} ${th.last_name}`.trim();
                const isSelected = th.id === selectedId;
                const specs = th.specialties ?? [];
                return (
                  <motion.div
                    key={th.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    onClick={() => handleCardClick(th)}
                    className={`group cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-[#5cc8fa] bg-[rgba(92,200,250,0.06)] shadow-[0_0_20px_rgba(92,200,250,0.15)]"
                        : "border-[rgba(184,110,249,0.18)] bg-[#1a0a2e] hover:border-[#b86ef9] hover:shadow-[0_4px_20px_rgba(184,110,249,0.15)] hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Photo ronde */}
                      <div className="relative shrink-0">
                        <div
                          className="h-[60px] w-[60px] rounded-full overflow-hidden"
                          style={{ background: "linear-gradient(135deg,#b86ef9,#5cc8fa)", padding: 2 }}
                        >
                          <div className="h-full w-full rounded-full overflow-hidden bg-[#1a1035]">
                            <TherapistAvatar
                              photoUrl={th.photo_url}
                              alt={fullName}
                              fallback={fullName[0]}
                            />
                          </div>
                        </div>
                        {/* Badge premium */}
                        {th.is_premium && (
                          <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[10px] shadow-md" title={t("therapist_profile.premium")}>
                            ⚡
                          </span>
                        )}
                        {!th.is_premium && th.verified && (
                          <span className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#b86ef9] text-[10px] shadow-md" title={t("therapist_profile.verified")}>
                            ✓
                          </span>
                        )}
                      </div>

                      {/* Infos */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-white truncate text-sm leading-snug">{fullName}</p>
                          <ArrowIcon />
                        </div>
                        {th.title && (
                          <p className="text-xs text-[#b86ef9] truncate">{th.title}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[rgba(255,255,255,0.45)]">
                          {th.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{th.city}
                            </span>
                          )}
                          {typeof th.distance_m === "number" && (
                            <span className="rounded-full bg-[rgba(92,200,250,0.12)] border border-[rgba(92,200,250,0.3)] px-2 py-0.5 text-[10px] text-[#5cc8fa]">
                              {(th.distance_m / 1000).toFixed(th.distance_m < 10000 ? 1 : 0)} km
                            </span>
                          )}
                          {th.price_min && (
                            <span>
                              {th.price_min}{th.price_max ? `–${th.price_max}` : ""}  {th.currency ?? "CHF"}
                            </span>
                          )}
                        </div>
                        {/* Chips spécialités */}
                        {specs.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {specs.slice(0, 3).map((s) => (
                              <span key={s} className="rounded-full bg-[rgba(184,110,249,0.1)] border border-[rgba(184,110,249,0.2)] px-2 py-0.5 text-[10px] text-[rgba(255,255,255,0.6)]">
                                {s}
                              </span>
                            ))}
                            {specs.length > 3 && (
                              <span className="rounded-full bg-[rgba(255,255,255,0.05)] px-2 py-0.5 text-[10px] text-[rgba(255,255,255,0.4)]">
                                +{specs.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Lien profil */}
                    <Link
                      to="/$lang/therapeute/$slug"
                      params={{ lang, slug: th.slug }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 hidden group-hover:flex items-center gap-1 text-xs font-semibold text-[#5cc8fa] hover:text-white transition"
                    >
                      {t("therapist_profile.see_full_profile")}
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {!isLoading && filtered.length === 0 && (
              <div className="py-16 text-center text-[rgba(255,255,255,0.4)] text-sm">
                {t("therapist_profile.no_therapist")}
              </div>
            )}
          </div>
        </div>

        {/* ── Carte (60%) — sticky ── */}
        <div className={`relative flex-1 ${mobileTab === "list" ? "hidden sm:block" : "block"}`}>
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center bg-[#0f0a1e]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#b86ef9] border-t-transparent" />
              </div>
            }
          >
            <TherapistMap
              therapists={filtered}
              selectedId={selectedId}
              onSelect={setSelectedId}
              lang={lang}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[rgba(184,110,249,0.4)] group-hover:text-[#b86ef9] group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
