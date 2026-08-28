import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { RefreshCw, Loader2 } from "lucide-react";
import { regenerateProposalStructure } from "@/lib/marketing-agent.functions";
import { Button } from "@/components/ui/button";

/**
 * Choix de la structure d'un carrousel AVANT validation (additif).
 * Ne modifie ni le statut, ni le workflow de validation : il ne fait que
 * réécrire la structure de la proposition, sur demande explicite de l'admin.
 */

const PAGE_OPTIONS = [2, 3, 4, 5] as const;
const PRESENTATIONS = [
  { value: "classic", label: "Classique" },
  { value: "condensed", label: "Condensée" },
  { value: "storytelling", label: "Storytelling" },
  { value: "conversion", label: "Conversion" },
] as const;

export type PresentationValue = (typeof PRESENTATIONS)[number]["value"];

const PRESENTATION_LABEL: Record<string, string> = Object.fromEntries(
  PRESENTATIONS.map((p) => [p.value, p.label]),
);

type Props = {
  proposalId: string;
  pageCount: number | null;
  presentation: string | null;
  lang: string;
  /** Pages telles qu'elles seraient affichées pour un nombre de pages donné. */
  slides: (pageCount: number) => { title: string; body: string | null }[];
  readOnly?: boolean;
};

function Segmented({
  options,
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Button
            key={o.value}
            type="button"
            variant="ghost"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] rounded-lg px-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] disabled:opacity-40 ${
              active
                ? "bg-gradient-to-r from-[#b86ef9] to-[#22d3ee] text-white"
                : "border border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}

export function CarouselStructure({
  proposalId,
  pageCount,
  presentation,
  lang,
  slides,
  readOnly,
}: Props) {
  const regenerate = useServerFn(regenerateProposalStructure);
  const qc = useQueryClient();

  const savedPages = pageCount ?? 3;
  const savedPresentation = (presentation ?? "classic") as PresentationValue;
  const [pages, setPages] = useState<number>(savedPages);
  const [pres, setPres] = useState<PresentationValue>(savedPresentation);
  const [busy, setBusy] = useState(false);

  const dirty = pages !== savedPages || pres !== savedPresentation;
  const preview = slides(pages);

  const onRegenerate = async () => {
    const ok = window.confirm(
      "Voulez-vous régénérer cette proposition avec cette nouvelle structure ? Le contenu actuel sera remplacé.",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await regenerate({
        data: { id: proposalId, pageCount: pages as 2 | 3 | 4 | 5, presentation: pres },
      });
      toast.success(`Proposition régénérée en ${pages} pages`);
      qc.invalidateQueries({ queryKey: ["marketing-proposals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Régénération impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-3 rounded-xl border border-white/10 bg-[#0f0a1e] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/50">
          Structure du carrousel
        </p>
        <p className="text-xs text-white/45">
          {pages} pages · Présentation {PRESENTATION_LABEL[pres]} · {lang.toUpperCase()}
          {pageCount == null && " (valeur par défaut)"}
        </p>
      </div>

      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1.5 text-sm text-white/70">Nombre de pages</p>
          <Segmented
            ariaLabel="Nombre de pages du carrousel"
            options={PAGE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            value={String(pages)}
            onChange={(v) => setPages(Number(v))}
            disabled={readOnly || busy}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm text-white/70">Présentation</p>
          <Segmented
            ariaLabel="Présentation du carrousel"
            options={PRESENTATIONS.map((p) => ({ value: p.value, label: p.label }))}
            value={pres}
            onChange={(v) => setPres(v as PresentationValue)}
            disabled={readOnly || busy}
          />
        </div>
      </div>

      {/* Aperçu des pages, format 4:5 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {preview.map((s, i) => (
          <figure
            key={i}
            className="relative flex aspect-[4/5] flex-col overflow-hidden rounded-lg border border-[rgba(184,110,249,0.25)] bg-gradient-to-b from-[#1a0a2e] to-[#2a1147] p-3"
          >
            <p className="text-[13px] font-semibold leading-snug text-white line-clamp-4">
              {s.title}
            </p>
            {s.body && (
              <p className="mt-1 text-[11px] leading-snug text-white/70 line-clamp-5">{s.body}</p>
            )}
            <figcaption className="mt-auto text-[11px] tabular-nums text-white/45">
              {i + 1}/{preview.length}
            </figcaption>
          </figure>
        ))}
      </div>

      {!readOnly && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onRegenerate}
            disabled={!dirty || busy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#b86ef9] px-4 text-sm font-semibold text-[#b86ef9] transition hover:bg-[rgba(184,110,249,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b86ef9] disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Régénérer la proposition
          </Button>
          {!dirty && (
            <span className="text-xs text-white/40">
              Modifiez le nombre de pages ou la présentation pour régénérer.
            </span>
          )}
        </div>
      )}
    </section>
  );
}
