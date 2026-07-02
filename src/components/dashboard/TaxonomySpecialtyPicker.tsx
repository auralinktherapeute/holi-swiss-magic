import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, X, Check, ChevronDown } from "lucide-react";
import { listAllSpecialties } from "@/lib/specialties.functions";
import { getMyTherapistSpecialtyIds } from "@/lib/dashboard.functions";

type Family = { id: string; slug: string; name_fr: string; sort_order: number };
type Spec = { id: string; slug: string; name_fr: string; family_id: string; aliases?: string[] };

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}

export function TaxonomySpecialtyPicker({
  selectedIds,
  onChange,
  onLabelsChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Called with the resolved labels (name_fr) whenever the selection changes — used to keep legacy therapists.specialties in sync */
  onLabelsChange?: (labels: string[]) => void;
}) {
  const fetchAll = useServerFn(listAllSpecialties);
  const fetchMine = useServerFn(getMyTherapistSpecialtyIds);
  const [search, setSearch] = useState("");
  const [openFam, setOpenFam] = useState<Record<string, boolean>>({});

  const tax = useQuery({ queryKey: ["taxonomy-public"], queryFn: () => fetchAll(), staleTime: 5 * 60 * 1000 });
  const mine = useQuery({ queryKey: ["my-specialty-ids"], queryFn: () => fetchMine() });

  // Initialize selection from server the first time it lands (only if parent has none yet)
  useEffect(() => {
    if (mine.data && selectedIds.length === 0 && (mine.data as any).specialty_ids?.length > 0) {
      onChange((mine.data as any).specialty_ids);
    }
     
  }, [mine.data]);

  const families: Family[] = (tax.data as any)?.families ?? [];
  const specs: Spec[] = (tax.data as any)?.specialties ?? [];

  // Open all families by default when data lands
  useEffect(() => {
    if (families.length > 0 && Object.keys(openFam).length === 0) {
      const o: Record<string, boolean> = {};
      families.forEach((f) => (o[f.id] = true));
      setOpenFam(o);
    }
     
  }, [families.length]);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const q = norm(search);
  const matches = (s: Spec) =>
    !q ||
    norm(s.name_fr).includes(q) ||
    (s.aliases ?? []).some((a: string) => norm(a).includes(q));

  const specsByFamily = useMemo(() => {
    const map = new Map<string, Spec[]>();
    for (const s of specs) {
      const arr = map.get(s.family_id) ?? [];
      arr.push(s);
      map.set(s.family_id, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.name_fr.localeCompare(b.name_fr));
    return map;
  }, [specs]);

  const toggle = (id: string, label: string) => {
    const next = selected.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    onChange(next);
    if (onLabelsChange) {
      const idToLabel = new Map(specs.map((s) => [s.id, s.name_fr]));
      onLabelsChange(next.map((i) => idToLabel.get(i) || label).filter(Boolean));
    }
  };

  const selectedSpecs = selectedIds
    .map((id) => specs.find((s) => s.id === id))
    .filter(Boolean) as Spec[];

  if (tax.isLoading) {
    return <div className="text-sm text-[#a89bc4]">Chargement de la taxonomie…</div>;
  }

  return (
    <div>
      {/* Selected recap */}
      {selectedSpecs.length > 0 && (
        <div className="mb-4 rounded-xl border border-[#b86ef9]/30 bg-[#b86ef9]/5 p-3">
          <p className="mb-2 text-xs font-medium text-[#d4a5f9]">
            Vos spécialités ({selectedSpecs.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedSpecs.map((s) => (
              <span key={s.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#b86ef9]/40 bg-[#b86ef9]/15 px-3 py-1 text-xs text-white">
                {s.name_fr}
                <button type="button" onClick={() => toggle(s.id, s.name_fr)} className="opacity-60 hover:opacity-100">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a89bc4]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (sophrologie, EMDR, ayurveda…)"
          className="w-full rounded-lg border border-[rgba(184,110,249,0.25)] bg-[rgba(20,8,40,0.5)] py-2 pl-9 pr-3 text-sm text-white placeholder-[#a89bc4] outline-none focus:border-[#b86ef9]"
        />
      </div>

      <p className="mt-3 text-xs text-[#a89bc4]">
        Choisissez toutes les spécialités que vous pratiquez — vous apparaîtrez dans chacune.
      </p>

      {/* Families accordion */}
      <div className="mt-4 space-y-3">
        {families
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((f) => {
            const items = (specsByFamily.get(f.id) ?? []).filter(matches);
            if (q && items.length === 0) return null;
            const isOpen = openFam[f.id] ?? true;
            const selectedInFamily = items.filter((s) => selected.has(s.id)).length;
            return (
              <div key={f.id} className="rounded-xl border border-[rgba(184,110,249,0.18)] bg-[rgba(20,8,40,0.35)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenFam((o) => ({ ...o, [f.id]: !isOpen }))}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-[rgba(184,110,249,0.05)]"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{f.name_fr}</div>
                    <div className="text-xs text-[#a89bc4]">
                      {items.length} spécialité{items.length > 1 ? "s" : ""}
                      {selectedInFamily > 0 && (
                        <span className="ml-2 rounded-full bg-[#b86ef9]/25 px-2 py-0.5 text-[10px] font-semibold text-white">
                          {selectedInFamily} sélectionnée{selectedInFamily > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-[#a89bc4] transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="border-t border-[rgba(184,110,249,0.12)] p-3">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {items.map((s) => {
                        const active = selected.has(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggle(s.id, s.name_fr)}
                            className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                              active
                                ? "border-[#b86ef9] bg-gradient-to-br from-[#b86ef9] to-[#a855f7] text-white shadow-md shadow-[#b86ef9]/20"
                                : "border-[rgba(184,110,249,0.2)] bg-[rgba(20,8,40,0.5)] text-[#d4c4e0] hover:border-[#b86ef9]/60"
                            }`}
                          >
                            {active && <Check className="h-3 w-3" />}
                            {s.name_fr}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
}