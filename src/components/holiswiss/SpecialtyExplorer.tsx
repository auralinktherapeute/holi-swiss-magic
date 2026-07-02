import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Brain, Leaf, Hand, Sparkles, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listFamiliesWithCounts, searchSpecialties, listAllSpecialties } from "@/lib/specialties.functions";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  brain: Brain,
  leaf: Leaf,
  hand: Hand,
  sparkles: Sparkles,
};

type Selection = { specialite?: string; famille?: string };

export function SpecialtyExplorer({
  lang: _lang,
  active,
  onSelect,
}: {
  lang: string;
  active: Selection;
  onSelect: (sel: Selection) => void;
}) {
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
    queryKey: ["specialty-search", debounced],
    enabled: debounced.length >= 2,
    queryFn: () => fetchSearch({ data: { q: debounced } }),
  });

  const all = useQuery({
    queryKey: ["specialty-all"],
    enabled: showAll,
    queryFn: () => fetchAll(),
  });

  const groupedAll = useMemo(() => {
    if (!all.data) return [];
    return all.data.families
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({
        ...f,
        items: all.data.specialties
          .filter((s) => s.family_id === f.id)
          .sort((a, b) => a.name_fr.localeCompare(b.name_fr)),
      }));
  }, [all.data]);

  return (
    <section className="w-full">
      {/* Search */}
      <div className="relative mx-auto max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[rgba(255,255,255,0.5)]" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Rechercher une spécialité (ex : EMDR, Ayurveda, Sonothérapie...)"
          aria-label="Rechercher une spécialité"
          className="w-full rounded-2xl border border-[rgba(184,110,249,0.35)] bg-[rgba(184,110,249,0.08)] py-3 pl-12 pr-4 text-sm text-white placeholder-[rgba(255,255,255,0.55)] outline-none focus:border-[#b86ef9] transition"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            aria-label="Effacer"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Autocomplete */}
        {debounced.length >= 2 && (
          <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-[rgba(184,110,249,0.3)] bg-[#1a0a2e] shadow-2xl">
            {search.isLoading && (
              <div className="px-4 py-3 text-sm text-white/50">Recherche…</div>
            )}
            {!search.isLoading && (search.data ?? []).length === 0 && (
              <div className="px-4 py-3 text-sm text-white/50">
                Aucune spécialité trouvée pour « {debounced} ».
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
                  <div className="text-sm font-medium text-white">{r.name_fr}</div>
                  <div className="text-xs text-[#b86ef9]">{r.family_name_fr}</div>
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
                <div className="text-sm font-semibold leading-snug text-white">{f.name_fr}</div>
                <div className="mt-1 text-xs text-white/50">
                  {f.specialties.length} spécialité{f.specialties.length > 1 ? "s" : ""}
                  {f.therapist_count > 0 && (
                    <> · {f.therapist_count} thérapeute{f.therapist_count > 1 ? "s" : ""}</>
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
          Voir toutes les spécialités →
        </button>
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-[#0f0a1e] border-[rgba(184,110,249,0.3)]">
          <DialogHeader>
            <DialogTitle className="text-white">Toutes les spécialités</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {all.isLoading && <div className="text-sm text-white/50">Chargement…</div>}
            {groupedAll.map((f) => (
              <div key={f.id}>
                <h3 className="mb-2 text-sm font-semibold text-[#b86ef9]">{f.name_fr}</h3>
                <div className="flex flex-wrap gap-2">
                  {f.items.map((s) => (
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
                      {s.name_fr}
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