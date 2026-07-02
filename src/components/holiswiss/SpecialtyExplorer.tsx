import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Brain, Leaf, Hand, Sparkles, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listFamiliesWithCounts, searchSpecialties, listAllSpecialties } from "@/lib/specialties.functions";
import { useTranslation } from "react-i18next";

function pick(row: any, lang: string, field: "name" | "description" = "name"): string {
  return row?.[`${field}_${lang}`] || row?.[`${field}_fr`] || "";
}

const T: Record<string, Record<string, string>> = {
  fr: {
    searchPlaceholder: "Rechercher une spécialité (ex : EMDR, Ayurveda, Sonothérapie…)",
    searchAria: "Rechercher une spécialité",
    clear: "Effacer",
    searching: "Recherche…",
    noResults: "Aucune spécialité trouvée pour",
    specialtyOne: "spécialité", specialtyMany: "spécialités",
    therapistOne: "thérapeute", therapistMany: "thérapeutes",
    seeAll: "Voir toutes les spécialités →",
    allTitle: "Toutes les spécialités",
    loading: "Chargement…",
  },
  de: {
    searchPlaceholder: "Fachrichtung suchen (z. B. EMDR, Ayurveda, Klangtherapie…)",
    searchAria: "Fachrichtung suchen",
    clear: "Löschen",
    searching: "Suche läuft…",
    noResults: "Keine Fachrichtung gefunden für",
    specialtyOne: "Fachrichtung", specialtyMany: "Fachrichtungen",
    therapistOne: "Therapeut", therapistMany: "Therapeuten",
    seeAll: "Alle Fachrichtungen anzeigen →",
    allTitle: "Alle Fachrichtungen",
    loading: "Wird geladen…",
  },
  it: {
    searchPlaceholder: "Cerca una specialità (es. EMDR, Ayurveda, Sonoterapia…)",
    searchAria: "Cerca una specialità",
    clear: "Cancella",
    searching: "Ricerca…",
    noResults: "Nessuna specialità trovata per",
    specialtyOne: "specialità", specialtyMany: "specialità",
    therapistOne: "terapeuta", therapistMany: "terapeuti",
    seeAll: "Vedi tutte le specialità →",
    allTitle: "Tutte le specialità",
    loading: "Caricamento…",
  },
  en: {
    searchPlaceholder: "Search a specialty (e.g. EMDR, Ayurveda, Sound therapy…)",
    searchAria: "Search a specialty",
    clear: "Clear",
    searching: "Searching…",
    noResults: "No specialty found for",
    specialtyOne: "specialty", specialtyMany: "specialties",
    therapistOne: "therapist", therapistMany: "therapists",
    seeAll: "See all specialties →",
    allTitle: "All specialties",
    loading: "Loading…",
  },
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  leaf: Leaf,
  hand: Hand,
  sparkles: Sparkles,
};

type Selection = { specialite?: string; famille?: string };

export function SpecialtyExplorer({
  lang,
  active,
  onSelect,
}: {
  lang: string;
  active: Selection;
  onSelect: (sel: Selection) => void;
}) {
  const { i18n } = useTranslation();
  const uiLang = (lang || i18n.language || "fr").slice(0, 2);
  const t = T[uiLang] ?? T.fr;
  const fetchFamilies = useServerFn(listFamiliesWithCounts);
  const fetchSearch = useServerFn(searchSpecialties);
  const fetchAll = useServerFn(listAllSpecialties);

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const families = useQuery({
    queryKey: ["specialty-families"],
    queryFn: () => fetchFamilies(),
    staleTime: 5 * 60 * 1000,
  });

  const search = useQuery({
    queryKey: ["specialty-search", debounced, uiLang],
    enabled: debounced.length >= 2,
    queryFn: () => fetchSearch({ data: { q: debounced, lang: uiLang } }),
  });

  const all = useQuery({
    queryKey: ["specialty-all"],
    enabled: showAll,
    queryFn: () => fetchAll(),
  });

  const groupedAll = useMemo(() => {
    if (!all.data) return [];
    return all.data.families
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((f: any) => ({
        ...f,
        items: all.data!.specialties
          .filter((s: any) => s.family_id === f.id)
          .sort((a: any, b: any) => pick(a, uiLang).localeCompare(pick(b, uiLang))),
      }));
  }, [all.data, uiLang]);

  return (
    <section className="w-full">
      {/* Search */}
      <div className="relative mx-auto max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgba(255,255,255,0.5)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder={t.searchPlaceholder}
          aria-label={t.searchAria}
          className="w-full rounded-2xl border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.08)] py-3 pl-12 pr-4 text-sm text-white placeholder-[rgba(255,255,255,0.55)] outline-none focus:border-[#b86ef9] transition"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label={t.clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Autocomplete */}
        {debounced.length >= 2 && (
          <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-[rgba(184,110,249,0.3)] bg-[#1a0a2e] shadow-2xl">
            {search.isLoading && (
              <div className="px-4 py-3 text-sm text-white/50">{t.searching}</div>
            )}
            {!search.isLoading && (search.data ?? []).length === 0 && (
              <div className="px-4 py-3 text-sm text-white/50">
                {t.noResults} « {debounced} ».
              </div>
            )}
            {(search.data ?? []).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  onSelect({ specialite: r.slug });
                  setQ("");
                }}
                className="flex w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left last:border-0 hover:bg-[rgba(184,110,249,0.12)]"
              >
                <div>
                  <div className="text-sm font-medium text-white">{pick(r, uiLang)}</div>
                  <div className="text-xs text-[#b86ef9]">{pick({ name_fr: (r as any).family_name_fr, name_de: (r as any).family_name_de, name_it: (r as any).family_name_it, name_en: (r as any).family_name_en }, uiLang)}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Families */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {families.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-[rgba(184,110,249,0.15)] bg-[#1a0a2e]"
            />
          ))}
        {(families.data ?? []).map((f) => {
          const Icon = ICONS[f.icon ?? ""] ?? Sparkles;
          const isActive = active.famille === f.slug;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(isActive ? {} : { famille: f.slug })}
              className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(184,110,249,0.25)] ${
                isActive
                  ? "border-[#b86ef9] bg-[rgba(184,110,249,0.18)] shadow-[0_8px_30px_rgba(184,110,249,0.3)]"
                  : "border-[rgba(184,110,249,0.25)] bg-gradient-to-br from-[#1a0a2e] to-[#2a1246] hover:border-[#b86ef9]"
              }`}
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${
                isActive ? "bg-[#b86ef9] text-white" : "bg-[#b86ef9]/20 text-[#b86ef9] group-hover:bg-[#b86ef9] group-hover:text-white"
              }`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3">
                <div className="text-sm font-semibold leading-snug text-white">{pick(f, uiLang)}</div>
                <div className="mt-1 text-xs text-white/50">
                  {f.specialties.length} {f.specialties.length > 1 ? t.specialtyMany : t.specialtyOne}
                  {f.therapist_count > 0 && (
                    <> · {f.therapist_count} {f.therapist_count > 1 ? t.therapistMany : t.therapistOne}</>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={() => setShowAll(true)}
          className="text-xs font-medium text-[#5cc8fa] underline-offset-4 hover:underline"
        >
          {t.seeAll}
        </button>
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0f0a1e] border-[rgba(184,110,249,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-white">{t.allTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {all.isLoading && <div className="text-sm text-white/50">{t.loading}</div>}
            {groupedAll.map((f) => (
              <div key={f.id}>
                <h3 className="mb-2 text-sm font-semibold text-[#b86ef9]">{pick(f, uiLang)}</h3>
                <div className="flex flex-wrap gap-2">
                  {f.items.map((s: any) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onSelect({ specialite: s.slug });
                        setShowAll(false);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs text-white transition ${
                        active.specialite === s.slug
                          ? "border-[#b86ef9] bg-[rgba(184,110,249,0.35)]"
                          : "border-[rgba(184,110,249,0.25)] bg-[rgba(184,110,249,0.08)] hover:border-[#b86ef9] hover:bg-[rgba(184,110,249,0.2)]"
                      }`}
                    >
                      {pick(s, uiLang)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}