import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, RotateCcw, X } from "lucide-react";
import type { Slide, SlideKind } from "@/components/admin/CarouselViewer";
import {
  chargerLotus,
  dessinerSlide,
  exporterSlides,
  type SlideAdjust,
} from "@/lib/carousel-export";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";

/**
 * Ajustement d'une image avant téléchargement : texte, taille et position
 * verticale, avec aperçu au rendu réel (le même canvas 1080 × 1350 que
 * l'export). Rien n'est enregistré côté serveur : les réglages ne servent
 * qu'à produire les PNG.
 */

const SANS_FILIGRANE: SlideKind[] = ["hook", "save", "rupture", "cta"];

const DEFAUT: Required<SlideAdjust> = { scale: 1, offsetY: 0, autofit: true };

function indexFiligrane(slides: Slide[], jusqua: number): number {
  let n = -1;
  for (let i = 0; i <= jusqua; i++) {
    if (!SANS_FILIGRANE.includes(slides[i].kind)) n += 1;
  }
  return Math.max(n, 0);
}

export function SlideAdjuster({
  slides,
  base,
  seulementLaPremiere = false,
  onClose,
}: {
  slides: Slide[];
  base: string;
  seulementLaPremiere?: boolean;
  onClose: () => void;
}) {
  const initiales = useMemo(
    () => (seulementLaPremiere ? slides.slice(0, 1) : slides),
    [slides, seulementLaPremiere],
  );

  const [edits, setEdits] = useState<Slide[]>(() => initiales.map((s) => ({ ...s })));
  const [reglages, setReglages] = useState<Record<number, SlideAdjust>>({});
  const [actif, setActif] = useState(0);
  const [lotus, setLotus] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const apercu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivant = true;
    chargerLotus(lotusAsset.url).then((img) => vivant && setLotus(img));
    return () => {
      vivant = false;
    };
  }, []);

  const reglage = { ...DEFAUT, ...(reglages[actif] ?? {}) };
  const slide = edits[actif];

  // Aperçu : on redessine à chaque changement, au rendu réel de l'export.
  useEffect(() => {
    const hote = apercu.current;
    if (!hote || !slide) return;
    const canvas = dessinerSlide(
      slide,
      actif,
      edits.length,
      lotus,
      indexFiligrane(edits, actif),
      reglage,
    );
    canvas.className = "block h-auto w-full rounded-xl";
    canvas.setAttribute("aria-label", `Aperçu de la slide ${actif + 1}`);
    hote.replaceChildren(canvas);
  }, [slide, actif, edits, lotus, reglage.scale, reglage.offsetY, reglage.autofit]);

  const majSlide = (patch: Partial<Slide>) =>
    setEdits((prev) => prev.map((s, i) => (i === actif ? { ...s, ...patch } : s)));

  const majReglage = (patch: SlideAdjust) =>
    setReglages((prev) => ({ ...prev, [actif]: { ...reglage, ...patch } }));

  const telecharger = async (uniquement: boolean) => {
    setBusy(true);
    try {
      if (uniquement) {
        await exporterSlides([edits[actif]], lotusAsset.url, `${base}-${String(actif + 1).padStart(2, "0")}`, true, {
          0: reglage,
        });
      } else {
        await exporterSlides(edits, lotusAsset.url, base, seulementLaPremiere, reglages);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!slide) return null;

  const champ =
    "w-full rounded-lg border border-white/15 bg-[#120620] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#b86ef9] focus:outline-none focus:ring-2 focus:ring-[#b86ef9]/40";

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Ajuster l'image avant téléchargement"
    >
      <div className="my-6 w-full max-w-4xl rounded-2xl border border-[rgba(184,110,249,0.3)] bg-[#1a0a2e] p-5">
        <header className="mb-4 flex items-center gap-3">
          <h2 className="text-base font-semibold text-white">Ajuster avant téléchargement</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {edits.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Choisir la slide">
            {edits.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActif(i)}
                aria-pressed={actif === i}
                className={`min-h-11 min-w-11 rounded-lg px-3 text-xs font-semibold transition ${
                  actif === i
                    ? "bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white"
                    : "border border-white/15 text-white/60 hover:text-white"
                }`}
              >
                {i + 1}
                <span className="sr-only"> — {s.kind}</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-[minmax(0,280px)_1fr]">
          <div ref={apercu} className="overflow-hidden rounded-xl border border-white/10" />

          <div className="space-y-4">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-white/70">
                Sur-titre
                <input
                  className={`mt-1 ${champ}`}
                  value={slide.label ?? ""}
                  onChange={(e) => majSlide({ label: e.target.value || undefined })}
                />
              </label>
              <label className="block text-xs font-semibold text-white/70">
                Titre
                <textarea
                  rows={2}
                  className={`mt-1 ${champ}`}
                  value={slide.title ?? ""}
                  onChange={(e) => majSlide({ title: e.target.value || undefined })}
                />
              </label>
              <label className="block text-xs font-semibold text-white/70">
                Texte
                <textarea
                  rows={3}
                  className={`mt-1 ${champ}`}
                  value={slide.body ?? ""}
                  onChange={(e) => majSlide({ body: e.target.value || undefined })}
                />
              </label>
              {slide.warn !== undefined && (
                <label className="block text-xs font-semibold text-white/70">
                  Avertissement
                  <textarea
                    rows={2}
                    className={`mt-1 ${champ}`}
                    value={slide.warn ?? ""}
                    onChange={(e) => majSlide({ warn: e.target.value || undefined })}
                  />
                </label>
              )}
              {slide.items && (
                <label className="block text-xs font-semibold text-white/70">
                  Puces (une par ligne)
                  <textarea
                    rows={4}
                    className={`mt-1 ${champ}`}
                    value={slide.items.join("\n")}
                    onChange={(e) =>
                      majSlide({ items: e.target.value.split("\n").filter((l) => l.trim()) })
                    }
                  />
                </label>
              )}
            </div>

            <div className="space-y-3 border-t border-white/10 pt-3">
              <label className="block text-xs font-semibold text-white/70">
                Taille du texte — {Math.round(reglage.scale * 100)} %
                <input
                  type="range"
                  min={60}
                  max={130}
                  step={2}
                  value={Math.round(reglage.scale * 100)}
                  onChange={(e) => majReglage({ scale: Number(e.target.value) / 100 })}
                  className="mt-2 w-full accent-[#b86ef9]"
                />
              </label>
              <label className="block text-xs font-semibold text-white/70">
                Position verticale — {reglage.offsetY} px
                <input
                  type="range"
                  min={-250}
                  max={250}
                  step={10}
                  value={reglage.offsetY}
                  onChange={(e) => majReglage({ offsetY: Number(e.target.value) })}
                  className="mt-2 w-full accent-[#b86ef9]"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
                <input
                  type="checkbox"
                  checked={reglage.autofit}
                  onChange={(e) => majReglage({ autofit: e.target.checked })}
                  className="h-4 w-4 accent-[#b86ef9]"
                />
                Réduire automatiquement si le texte déborde
              </label>
              <button
                type="button"
                onClick={() => setReglages((p) => ({ ...p, [actif]: { ...DEFAUT } }))}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white/70 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser cette slide
              </button>
            </div>
          </div>
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => telecharger(true)}
            disabled={busy}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-4 text-sm font-semibold text-white/75 transition hover:text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#b86ef9]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Cette image
          </button>
          <button
            type="button"
            onClick={() => telecharger(false)}
            disabled={busy}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] px-4 text-sm font-semibold text-white transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {seulementLaPremiere || edits.length === 1 ? "Télécharger" : `Tout (${edits.length})`}
          </button>
        </footer>
      </div>
    </div>
  );
}
