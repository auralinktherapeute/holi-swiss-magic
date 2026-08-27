import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Search, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  getFeaturedSelection,
  searchFeaturableTherapists,
  setFeaturedTherapist,
} from "@/lib/featured-therapist.functions";

/** Sélection du « Thérapeute à la Une » affiché sur la page d'accueil. */
export function FeaturedTherapistPicker() {
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const fetchSelection = useServerFn(getFeaturedSelection);
  const searchFn = useServerFn(searchFeaturableTherapists);
  const setFn = useServerFn(setFeaturedTherapist);

  const { data: selection } = useQuery({
    queryKey: ["admin-featured-selection"],
    queryFn: () => fetchSelection({}),
  });

  const { data: results, isFetching } = useQuery({
    queryKey: ["admin-featurable", search],
    queryFn: () => searchFn({ data: { search } }),
  });

  const apply = async (therapistId: string | null) => {
    setBusy(true);
    try {
      await setFn({ data: { therapistId } });
      await qc.invalidateQueries({ queryKey: ["admin-featured-selection"] });
      toast.success(therapistId ? "Thérapeute mis à la Une." : "Mise en avant retirée.");
    } catch (e: any) {
      toast.error(e?.message ?? "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const current = selection?.therapist ?? null;

  return (
    <section className="adm-card" style={{ padding: 20, marginBottom: 20 }} aria-labelledby="featured-picker-title">
      <h2 id="featured-picker-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "#fff" }}>
        <Sparkles size={16} style={{ color: "#f5c97a" }} aria-hidden />
        Thérapeute à la Une (page d'accueil)
      </h2>

      <p style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
        {current
          ? `Actuellement mis en avant : ${current.first_name} ${current.last_name}`
          : "Aucun thérapeute mis en avant — la section est masquée sur la page d'accueil."}
      </p>

      {current && (
        <button
          type="button"
          onClick={() => apply(null)}
          disabled={busy}
          className="adm-btn"
          style={{ marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6, minHeight: 44 }}
        >
          <X size={14} aria-hidden /> Retirer la mise en avant
        </button>
      )}

      <label htmlFor="featured-search" style={{ display: "block", marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
        Rechercher un thérapeute actif
      </label>
      <div style={{ position: "relative", marginTop: 6 }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: 15, color: "rgba(255,255,255,0.45)" }} aria-hidden />
        <input
          id="featured-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Nom, prénom ou ville"
          className="adm-input"
          style={{ paddingLeft: 30, minHeight: 44, width: "100%" }}
        />
      </div>

      <div style={{ marginTop: 12, maxHeight: 280, overflowY: "auto", display: "grid", gap: 6 }}>
        {isFetching && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Loader2 size={14} className="animate-spin" aria-hidden /> Chargement…
          </span>
        )}
        {(results?.rows ?? []).map((r) => {
          const active = current?.id === r.id;
          return (
            <button
              key={r.id}
              type="button"
              disabled={busy || active}
              onClick={() => apply(r.id)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                minHeight: 44, padding: "8px 12px", borderRadius: 10, textAlign: "left",
                border: `1px solid ${active ? "#b86ef9" : "rgba(255,255,255,0.12)"}`,
                background: active ? "rgba(184,110,249,0.15)" : "rgba(255,255,255,0.03)",
                color: "#fff", fontSize: 13, cursor: active ? "default" : "pointer",
              }}
            >
              <span>
                {r.first_name} {r.last_name}
                <span style={{ color: "rgba(255,255,255,0.55)" }}>
                  {r.city || r.canton ? ` — ${[r.city, r.canton].filter(Boolean).join(" · ")}` : ""}
                </span>
              </span>
              <span style={{ fontSize: 11, color: active ? "#e2c6ff" : "#d4a5f9" }}>
                {active ? "À la Une" : "Mettre à la Une"}
              </span>
            </button>
          );
        })}
        {!isFetching && (results?.rows ?? []).length === 0 && (
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Aucun résultat.</span>
        )}
      </div>
    </section>
  );
}
