import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Download,
  Loader2,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import type { Slide, SlideKind } from "@/components/admin/CarouselViewer";
import {
  chargerLotus,
  exporterSlides,
  fondSlide,
  policesPretes,
  rendreSlide,
  styleParDefaut,
  type Align,
  type BlockKey,
  type BlockStyle,
  type SlideAdjust,
} from "@/lib/carousel-export";
import { ActionTooltip } from "@/components/admin/ActionTooltip";
import lotusAsset from "@/assets/lotus-transparent.png.asset.json";

/**
 * Ajustement d'une image avant téléchargement : contenu, mise en forme par
 * bloc (sur-titre / titre / texte), taille et position verticale, avec aperçu
 * au rendu réel — le même canvas 1080 × 1350 que l'export, donc le fichier
 * téléchargé est strictement identique à ce qui est affiché.
 *
 * Rien n'est enregistré côté serveur : les carrousels viennent de
 * `src/data/marketing-carousels.ts`, les réglages ne servent qu'à produire les
 * PNG. Aucune migration base n'est donc nécessaire.
 */

const SANS_FILIGRANE: SlideKind[] = ["hook", "save", "rupture", "cta"];

const DEFAUT: SlideAdjust = { scale: 1, offsetY: 0, autofit: true };

const BLOCS: { key: BlockKey; label: string; champ: "label" | "title" | "body" }[] = [
  { key: "label", label: "Sur-titre", champ: "label" },
  { key: "title", label: "Titre", champ: "title" },
  { key: "body", label: "Texte", champ: "body" },
];

/** Palette Holiswiss + gris lisibles. */
const PALETTE: { hex: string; nom: string }[] = [
  { hex: "#ffffff", nom: "Blanc" },
  { hex: "#e9dcf5", nom: "Blanc cassé" },
  { hex: "#d4c4e0", nom: "Gris lilas" },
  { hex: "#b86ef9", nom: "Violet Holiswiss" },
  { hex: "#5cc8fa", nom: "Bleu Holiswiss" },
  { hex: "#22d3ee", nom: "Cyan accent" },
  { hex: "#f0806a", nom: "Corail accent" },
  { hex: "#120620", nom: "Violet très foncé" },
];

const PRESETS: { nom: string; f: number }[] = [
  { nom: "XS", f: 0.65 },
  { nom: "S", f: 0.82 },
  { nom: "M", f: 1 },
  { nom: "L", f: 1.25 },
  { nom: "XL", f: 1.5 },
  { nom: "XXL", f: 1.85 },
];

const MIN_PX = 16;
const MAX_PX = 160;

function indexFiligrane(slides: Slide[], jusqua: number): number {
  let n = -1;
  for (let i = 0; i <= jusqua; i++) {
    if (!SANS_FILIGRANE.includes(slides[i].kind)) n += 1;
  }
  return Math.max(n, 0);
}

/* ---------------------------- contraste ---------------------------- */

function versRgb(c: string): [number, number, number] {
  const hex = c.trim();
  if (hex.startsWith("#")) {
    const h = hex.length === 4 ? hex.replace(/#(.)(.)(.)/, "#$1$1$2$2$3$3") : hex;
    return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  }
  const m = hex.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(",").map((v) => Number(v.trim()));
    return [r, g, b];
  }
  return [255, 255, 255];
}

function luminance(c: string): number {
  const [r, g, b] = versRgb(c).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/* ------------------------------ composant ------------------------------ */

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
  const [bloc, setBloc] = useState<BlockKey>("title");
  const [lotus, setLotus] = useState<HTMLImageElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [etat, setEtat] = useState<{ deborde: boolean; reduit: boolean }>({
    deborde: false,
    reduit: false,
  });
  const apercu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivant = true;
    policesPretes()
      .then(() => chargerLotus(lotusAsset.url))
      .then((img) => vivant && setLotus(img));
    return () => {
      vivant = false;
    };
  }, []);

  const reglage: SlideAdjust = { ...DEFAUT, ...(reglages[actif] ?? {}) };
  const slide = edits[actif];
  const kind = slide?.kind ?? "body";
  const defautBloc = styleParDefaut(kind, bloc);
  const styleActif: Required<BlockStyle> = { ...defautBloc, ...(reglage[bloc] ?? {}) };
  const ratio = contraste(styleActif.color, fondSlide(kind));

  // Aperçu : on redessine à chaque changement, au rendu réel de l'export.
  useEffect(() => {
    const hote = apercu.current;
    if (!hote || !slide) return;
    const { canvas, deborde, reduit } = rendreSlide(
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
    setEtat({ deborde, reduit });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide, actif, edits, lotus, JSON.stringify(reglage)]);

  const majSlide = (patch: Partial<Slide>) =>
    setEdits((prev) => prev.map((s, i) => (i === actif ? { ...s, ...patch } : s)));

  const majReglage = (patch: SlideAdjust) =>
    setReglages((prev) => ({ ...prev, [actif]: { ...reglage, ...patch } }));

  const majStyle = (patch: BlockStyle) =>
    majReglage({ [bloc]: { ...(reglage[bloc] ?? {}), ...patch } } as SlideAdjust);

  const majTaille = (px: number) =>
    majStyle({ size: Math.min(MAX_PX, Math.max(MIN_PX, Math.round(px))) });

  const telecharger = async (uniquement: boolean) => {
    setBusy(true);
    setErreur(null);
    try {
      if (uniquement) {
        await exporterSlides(
          [edits[actif]],
          lotusAsset.url,
          `${base}-${String(actif + 1).padStart(2, "0")}`,
          true,
          { 0: reglage },
        );
      } else {
        await exporterSlides(edits, lotusAsset.url, base, seulementLaPremiere, reglages);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Le téléchargement a échoué.");
    } finally {
      setBusy(false);
    }
  };

  if (!slide) return null;

  const champ =
    "w-full rounded-lg border border-white/15 bg-[#120620] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#b86ef9] focus:outline-none focus:ring-2 focus:ring-[#b86ef9]/40";
  const btn =
    "flex h-11 min-w-11 items-center justify-center rounded-lg border border-white/15 px-3 text-xs font-semibold text-white/70 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]";
  const btnActif = "border-transparent bg-gradient-to-r from-[#b86ef9] to-[#5cc8fa] text-white";

  const aligns: { v: Align; icone: typeof AlignLeft; nom: string }[] = [
    { v: "left", icone: AlignLeft, nom: "Aligner à gauche" },
    { v: "center", icone: AlignCenter, nom: "Centrer" },
    { v: "right", icone: AlignRight, nom: "Aligner à droite" },
  ];

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
          <div className="space-y-2">
            <div ref={apercu} className="overflow-hidden rounded-xl border border-white/10" />
            {etat.reduit && !etat.deborde && (
              <p className="text-[11px] text-white/50">
                Texte réduit automatiquement pour tenir dans l'image.
              </p>
            )}
            {etat.deborde && (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Le texte dépasse la zone visible. Raccourcissez le texte, réduisez la taille ou
                répartissez le contenu sur une slide supplémentaire.
              </p>
            )}
          </div>

          <div className="space-y-4">
            {/* ---- barre d'outils de mise en forme ---- */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Bloc
                </span>
                <div className="flex gap-1" role="group" aria-label="Bloc à mettre en forme">
                  {BLOCS.map((b) => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => setBloc(b.key)}
                      aria-pressed={bloc === b.key}
                      className={`${btn} ${bloc === b.key ? btnActif : ""}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <ActionTooltip label="Mettre ce bloc en gras">
                  <button
                    type="button"
                    onClick={() => majStyle({ bold: !styleActif.bold })}
                    aria-pressed={styleActif.bold}
                    aria-label="Gras"
                    className={`${btn} ${styleActif.bold ? btnActif : ""}`}
                  >
                    <Bold className="h-4 w-4" />
                  </button>
                </ActionTooltip>

                <div className="flex gap-1" role="group" aria-label="Alignement du bloc">
                  {aligns.map(({ v, icone: Icone, nom }) => (
                    <ActionTooltip key={v} label={nom}>
                      <button
                        type="button"
                        onClick={() => majStyle({ align: v })}
                        aria-pressed={styleActif.align === v}
                        aria-label={nom}
                        className={`${btn} ${styleActif.align === v ? btnActif : ""}`}
                      >
                        <Icone className="h-4 w-4" />
                      </button>
                    </ActionTooltip>
                  ))}
                </div>

                <div className="ml-auto flex items-center gap-1">
                  <ActionTooltip label="Réduire la taille">
                    <button
                      type="button"
                      aria-label="Réduire la taille"
                      onClick={() => majTaille(styleActif.size - 2)}
                      className={btn}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </ActionTooltip>
                  <label className="sr-only" htmlFor="taille-bloc">
                    Taille de police en pixels
                  </label>
                  <input
                    id="taille-bloc"
                    type="number"
                    min={MIN_PX}
                    max={MAX_PX}
                    value={styleActif.size}
                    onChange={(e) => majTaille(Number(e.target.value))}
                    className="h-11 w-20 rounded-lg border border-white/15 bg-[#120620] px-2 text-center text-sm tabular-nums text-white focus:border-[#b86ef9] focus:outline-none focus:ring-2 focus:ring-[#b86ef9]/40"
                  />
                  <span className="text-[11px] text-white/40">px</span>
                  <ActionTooltip label="Agrandir la taille">
                    <button
                      type="button"
                      aria-label="Agrandir la taille"
                      onClick={() => majTaille(styleActif.size + 2)}
                      className={btn}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </ActionTooltip>
                </div>
              </div>

              <div className="flex flex-wrap gap-1" role="group" aria-label="Tailles prédéfinies">
                {PRESETS.map((p) => {
                  const px = Math.round(defautBloc.size * p.f);
                  return (
                    <button
                      key={p.nom}
                      type="button"
                      onClick={() => majTaille(px)}
                      aria-pressed={styleActif.size === px}
                      title={`${p.nom} — ${px} px`}
                      className={`${btn} ${styleActif.size === px ? btnActif : ""}`}
                    >
                      {p.nom}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/40">
                  Couleur du {BLOCS.find((b) => b.key === bloc)?.label.toLowerCase()}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PALETTE.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => majStyle({ color: c.hex })}
                      aria-label={c.nom}
                      aria-pressed={styleActif.color.toLowerCase() === c.hex}
                      title={c.nom}
                      className={`h-11 w-11 rounded-lg border-2 transition focus:outline-none focus:ring-2 focus:ring-[#b86ef9] ${
                        styleActif.color.toLowerCase() === c.hex
                          ? "border-white"
                          : "border-white/15"
                      }`}
                      style={{ background: c.hex }}
                    />
                  ))}
                  <label className="flex h-11 items-center gap-2 rounded-lg border border-white/15 px-2 text-[11px] text-white/60">
                    <span className="sr-only">Couleur personnalisée</span>
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(styleActif.color) ? styleActif.color : "#ffffff"}
                      onChange={(e) => majStyle({ color: e.target.value })}
                      aria-label="Couleur personnalisée"
                      className="h-7 w-9 cursor-pointer rounded bg-transparent"
                    />
                    Perso.
                  </label>
                  <input
                    type="text"
                    value={styleActif.color}
                    onChange={(e) => majStyle({ color: e.target.value })}
                    aria-label="Code couleur HEX"
                    spellCheck={false}
                    className="h-11 w-28 rounded-lg border border-white/15 bg-[#120620] px-2 text-xs text-white focus:border-[#b86ef9] focus:outline-none focus:ring-2 focus:ring-[#b86ef9]/40"
                  />
                </div>
                {ratio < 4.5 && (
                  <p className="flex items-start gap-1.5 text-[11px] text-amber-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Contraste faible sur ce fond ({ratio.toFixed(1)}:1). Un ton clair comme
                    #e9dcf5 ou #ffffff serait plus lisible.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => majReglage({ [bloc]: undefined } as SlideAdjust)}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 px-3 text-xs font-semibold text-white/70 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[#b86ef9]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser le style du bloc
              </button>
            </div>

            {/* ---- contenus ---- */}
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-white/70">
                Sur-titre
                <input
                  className={`mt-1 ${champ}`}
                  value={slide.label ?? ""}
                  onFocus={() => setBloc("label")}
                  onChange={(e) => majSlide({ label: e.target.value || undefined })}
                />
              </label>
              <label className="block text-xs font-semibold text-white/70">
                Titre
                <textarea
                  rows={2}
                  className={`mt-1 ${champ}`}
                  value={slide.title ?? ""}
                  onFocus={() => setBloc("title")}
                  onChange={(e) => majSlide({ title: e.target.value || undefined })}
                />
              </label>
              <label className="block text-xs font-semibold text-white/70">
                Texte
                <textarea
                  rows={3}
                  className={`mt-1 ${champ}`}
                  value={slide.body ?? ""}
                  onFocus={() => setBloc("body")}
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
                    onFocus={() => setBloc("body")}
                    onChange={(e) =>
                      majSlide({ items: e.target.value.split("\n").filter((l) => l.trim()) })
                    }
                  />
                </label>
              )}
            </div>

            {/* ---- réglages globaux de la slide ---- */}
            <div className="space-y-3 border-t border-white/10 pt-3">
              <label className="block text-xs font-semibold text-white/70">
                Taille globale du texte — {Math.round((reglage.scale ?? 1) * 100)} %
                <input
                  type="range"
                  min={60}
                  max={130}
                  step={2}
                  value={Math.round((reglage.scale ?? 1) * 100)}
                  onChange={(e) => majReglage({ scale: Number(e.target.value) / 100 })}
                  className="mt-2 w-full accent-[#b86ef9]"
                />
              </label>
              <label className="block text-xs font-semibold text-white/70">
                Position verticale — {reglage.offsetY ?? 0} px
                <input
                  type="range"
                  min={-250}
                  max={250}
                  step={10}
                  value={reglage.offsetY ?? 0}
                  onChange={(e) => majReglage({ offsetY: Number(e.target.value) })}
                  className="mt-2 w-full accent-[#b86ef9]"
                />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-white/70">
                <input
                  type="checkbox"
                  checked={reglage.autofit !== false}
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

        {erreur && (
          <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {erreur}
          </p>
        )}

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
