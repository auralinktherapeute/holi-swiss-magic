import type { Slide, SlideKind } from "@/components/admin/CarouselViewer";

/**
 * Export des slides en PNG 1080 × 1350 (4:5), prêtes à publier sur Instagram.
 *
 * Dessin natif en Canvas, sans dépendance. C'est aussi ce qui permet d'appliquer
 * les VRAIES cotes du socle (§ 7) plutôt que la version réduite affichée à
 * l'écran : marque de pied 70 px, filigrane 690 px à 7 %, signature 215 px.
 *
 * Le MÊME code sert à l'aperçu de l'éditeur et au fichier téléchargé : ce qui
 * est vu est donc exactement ce qui est exporté.
 */

export const W = 1080;
export const H = 1350;

const PAD = 88;
/** Zone de sécurité basse de l'interface Instagram — aucun texte en dessous. */
const SAFE_BOTTOM = 120;

const SERIF = '"Playfair Display", "Iowan Old Style", Palatino, Georgia, serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const CYAN = "#22d3ee";
const CORAIL = "#f0806a";

/** Positions alternées du filigrane, en coordonnées 1080 × 1350. */
const WATERMARK_POS: { x: number; y: number }[] = [
  { x: W - 500, y: H - 520 },
  { x: -180, y: H - 500 },
  { x: W - 480, y: -190 },
];

/** Slides où le vide EST le propos — pas de filigrane (socle § 7). */
const SANS_FILIGRANE: SlideKind[] = ["hook", "save", "rupture", "cta"];

export type Align = "left" | "center" | "right";
export type BlockKey = "label" | "title" | "body";

/** Style d'un bloc de texte. Toute clé absente reprend la valeur du gabarit. */
export type BlockStyle = {
  /** Taille en pixels du canvas 1080 × 1350. */
  size?: number;
  bold?: boolean;
  color?: string;
  align?: Align;
};

/** Réglages manuels appliqués à une slide avant export. */
export type SlideAdjust = {
  /** Facteur d'échelle globale du texte (1 = taille de référence). */
  scale?: number;
  /** Décalage vertical du bloc de contenu, en pixels 1080 × 1350. */
  offsetY?: number;
  /** Réduit automatiquement le texte qui déborderait de la zone sûre. */
  autofit?: boolean;
  label?: BlockStyle;
  title?: BlockStyle;
  body?: BlockStyle;
};

/** Couleur de fond dominante d'une slide — sert au contrôle de contraste. */
export function fondSlide(kind: SlideKind): string {
  return kind === "rupture" ? "#120620" : kind === "save" ? "#33205a" : "#3d2460";
}

/** Style de référence du gabarit, par type de slide et par bloc. */
export function styleParDefaut(kind: SlideKind, bloc: BlockKey): Required<BlockStyle> {
  if (bloc === "label") {
    return {
      size: 34,
      bold: true,
      color: kind === "rupture" ? CORAIL : CYAN,
      align: "left",
    };
  }
  if (bloc === "title") {
    return { size: kind === "hook" ? 92 : 68, bold: false, color: "#ffffff", align: "left" };
  }
  return {
    size: 48,
    bold: false,
    color: kind === "cta" ? CYAN : "rgba(255,255,255,0.72)",
    align: "left",
  };
}

function styleBloc(kind: SlideKind, bloc: BlockKey, adjust: SlideAdjust): Required<BlockStyle> {
  return { ...styleParDefaut(kind, bloc), ...(adjust[bloc] ?? {}) };
}

/** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
function lignes(ctx: CanvasRenderingContext2D, texte: string, largeur: number): string[] {
  const out: string[] = [];
  for (const paragraphe of texte.split("\n")) {
    let ligne = "";
    for (const mot of paragraphe.split(" ")) {
      const essai = ligne ? `${ligne} ${mot}` : mot;
      if (ctx.measureText(essai).width > largeur && ligne) {
        out.push(ligne);
        ligne = mot;
      } else {
        ligne = essai;
      }
    }
    out.push(ligne);
  }
  return out;
}

/** Abscisse d'une ligne selon l'alignement demandé, dans la colonne utile. */
function abscisse(ctx: CanvasRenderingContext2D, ligne: string, align: Align, gauche = PAD, largeur = W - PAD * 2): number {
  if (align === "left") return gauche;
  const l = ctx.measureText(ligne).width;
  return align === "center" ? gauche + (largeur - l) / 2 : gauche + largeur - l;
}

function fond(ctx: CanvasRenderingContext2D, kind: SlideKind) {
  if (kind === "rupture") {
    ctx.fillStyle = "#120620";
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const centres: Partial<Record<SlideKind, [number, number, string]>> = {
    hook: [0.5, 0, "#4a2b74"],
    body: [0.2, 0, "#3d2460"],
    accent: [0.8, 0.1, "#4a2b74"],
    save: [0.5, 1, "#33205a"],
    cta: [0.5, 0.45, "#2d1b4e"],
  };
  const [cx, cy, teinte] = centres[kind] ?? centres.body!;
  const g = ctx.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, H * 1.05);
  g.addColorStop(0, teinte);
  g.addColorStop(kind === "save" ? 0.65 : 0.64, kind === "save" ? "#160823" : "#1a0a2e");
  g.addColorStop(1, kind === "save" ? "#160823" : "#1a0a2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function ecrire(
  ctx: CanvasRenderingContext2D,
  texte: string,
  y: number,
  opts: {
    police: string;
    poids?: string;
    taille: number;
    couleur: string;
    align: Align;
    interligne: number;
    espacement?: number;
    dessine?: boolean;
  },
): number {
  ctx.font = `${opts.poids ? `${opts.poids} ` : ""}${opts.taille}px ${opts.police}`;
  ctx.fillStyle = opts.couleur;
  if (opts.espacement) (ctx as any).letterSpacing = `${opts.espacement}px`;
  let curseur = y;
  for (const l of lignes(ctx, texte, W - PAD * 2)) {
    if (opts.dessine !== false) ctx.fillText(l, abscisse(ctx, l, opts.align), curseur);
    curseur += opts.taille * opts.interligne;
  }
  if (opts.espacement) (ctx as any).letterSpacing = "0px";
  return curseur;
}

export type RenduSlide = {
  canvas: HTMLCanvasElement;
  /** Facteur réellement appliqué après réduction automatique. */
  facteur: number;
  /** Vrai si le contenu dépasse encore la zone sûre au facteur appliqué. */
  deborde: boolean;
  /** Vrai si la réduction automatique a dû intervenir. */
  reduit: boolean;
};

/** Dessine une slide au rendu réel et rend le canvas + l'état de débordement. */
export function rendreSlide(
  slide: Slide,
  index: number,
  total: number,
  lotus: HTMLImageElement | null,
  indexFiligrane: number,
  adjust: SlideAdjust = {},
): RenduSlide {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "top";

  fond(ctx, slide.kind);

  // Filet dégradé en haut
  const filet = ctx.createLinearGradient(0, 0, W, 0);
  filet.addColorStop(0, "#a855f7");
  filet.addColorStop(1, CYAN);
  ctx.fillStyle = filet;
  ctx.fillRect(0, 0, W, 9);

  // Filigrane — 690 px à 7 %, positions alternées, débordant du cadre
  if (lotus && !SANS_FILIGRANE.includes(slide.kind)) {
    const p = WATERMARK_POS[indexFiligrane % WATERMARK_POS.length];
    ctx.globalAlpha = 0.07;
    ctx.drawImage(lotus, p.x, p.y, 690, 690);
    ctx.globalAlpha = 1;
  }

  const yPied = H - SAFE_BOTTOM - 70;
  const centre = slide.kind === "rupture" || slide.kind === "cta";
  const decalage = adjust.offsetY ?? 0;

  const sLabel = styleBloc(slide.kind, "label", adjust);
  const sTitre = styleBloc(slide.kind, "title", adjust);
  const sTexte = styleBloc(slide.kind, "body", adjust);

  /** Dessine (ou mesure seulement) le bloc de contenu à l'échelle donnée. */
  const contenu = (f: number, dessine: boolean): number => {
    let y = (centre ? H * 0.34 : PAD + 40) + decalage;

    if (slide.kind === "cta" && lotus) {
      if (dessine) ctx.drawImage(lotus, PAD, y - 70, 215 * f, 215 * f);
      y += 175 * f;
    }

    if (slide.label) {
      y = ecrire(ctx, slide.label.toUpperCase(), y, {
        police: SANS,
        poids: sLabel.bold ? "700" : "400",
        taille: sLabel.size * f,
        couleur: sLabel.color,
        align: sLabel.align,
        interligne: 1.35,
        espacement: 4,
        dessine,
      });
      y += 22 * f;
    }
    if (slide.title) {
      y = ecrire(ctx, slide.title, y, {
        police: SERIF,
        poids: sTitre.bold ? "700" : undefined,
        taille: sTitre.size * f,
        couleur: sTitre.color,
        align: sTitre.align,
        interligne: 1.24,
        dessine,
      });
      y += 26 * f;
    }
    if (slide.body) {
      y = ecrire(ctx, slide.body, y, {
        police: SANS,
        poids: sTexte.bold ? "700" : undefined,
        taille: sTexte.size * f,
        couleur: sTexte.color,
        align: sTexte.align,
        interligne: 1.5,
        dessine,
      });
      y += 20 * f;
    }
    if (slide.warn) {
      y = ecrire(ctx, slide.warn, y, {
        police: SANS,
        poids: "500",
        taille: 46 * f,
        couleur: CORAIL,
        align: sTexte.align,
        interligne: 1.45,
        dessine,
      });
      y += 20 * f;
    }
    if (slide.items) {
      const tailleItem = Math.min(sTexte.size, 44) * f;
      for (const item of slide.items) {
        ctx.font = `${sTexte.bold ? "700 " : ""}${tailleItem}px ${SANS}`;
        if (dessine) {
          ctx.fillStyle = slide.kind === "save" ? CORAIL : CYAN;
          ctx.fillText("·", PAD, y);
        }
        ctx.fillStyle = sTexte.color;
        let cy = y;
        for (const l of lignes(ctx, item, W - PAD * 2 - 40 * f)) {
          if (dessine) {
            ctx.fillText(l, abscisse(ctx, l, sTexte.align, PAD + 34 * f, W - PAD * 2 - 34 * f), cy);
          }
          cy += tailleItem * 1.34;
        }
        y = cy + 14 * f;
      }
    }
    return y;
  };

  // ---- échelle : réglage manuel, puis réduction auto si ça déborde ----
  const demande = adjust.scale ?? 1;
  let f = demande;
  const limite = yPied - 24;
  if (adjust.autofit !== false) {
    while (f > 0.45 && contenu(f, false) > limite) f -= 0.04;
  }
  const deborde = contenu(f, false) > limite;
  contenu(f, true);

  // ---- pied de slide, au-dessus de la zone de sécurité ----
  if (slide.kind === "cta") {
    ctx.font = `28px ${SANS}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    (ctx as any).letterSpacing = "3px";
    ctx.fillText("holiswiss.ch", PAD, yPied + 24);
    (ctx as any).letterSpacing = "0px";
  } else if (lotus) {
    ctx.globalAlpha = 0.85;
    ctx.drawImage(lotus, PAD, yPied, 70, 70);
    ctx.globalAlpha = 1;
  }

  ctx.font = `28px ${SANS}`;
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  const num = `${index + 1}/${total}`;
  ctx.fillText(num, W - PAD - ctx.measureText(num).width, yPied + 24);

  return { canvas: c, facteur: f, deborde, reduit: f < demande - 0.001 };
}

/** Compatibilité : rend uniquement le canvas. */
export function dessinerSlide(
  slide: Slide,
  index: number,
  total: number,
  lotus: HTMLImageElement | null,
  indexFiligrane: number,
  adjust: SlideAdjust = {},
): HTMLCanvasElement {
  return rendreSlide(slide, index, total, lotus, indexFiligrane, adjust).canvas;
}

export function chargerLotus(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // l'export doit aboutir même sans logo
    img.src = url;
  });
}

/** Attend que les polices du document soient prêtes avant de mesurer/dessiner. */
export async function policesPretes(): Promise<void> {
  try {
    await (document as any).fonts?.ready;
  } catch {
    /* rendu possible avec les polices système */
  }
}

function telecharger(canvas: HTMLCanvasElement, nom: string): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Le fichier image n'a pas pu être généré."));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nom;
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve();
      }, 120);
    }, "image/png");
  });
}

/** Slugifie un titre pour en faire un nom de fichier lisible. */
export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Exporte les slides demandées. Les téléchargements sont séquentiels et
 * espacés : plusieurs `click()` simultanés font que le navigateur n'en
 * retient qu'un.
 */
export async function exporterSlides(
  slides: Slide[],
  lotusUrl: string,
  base: string,
  seulementLaPremiere = false,
  reglages: Record<number, SlideAdjust> = {},
): Promise<number> {
  await policesPretes();
  const lotus = await chargerLotus(lotusUrl);
  const aExporter = seulementLaPremiere ? slides.slice(0, 1) : slides;
  let filigrane = -1;
  let n = 0;

  for (let i = 0; i < slides.length; i++) {
    if (!SANS_FILIGRANE.includes(slides[i].kind)) filigrane += 1;
    if (seulementLaPremiere && i > 0) break;
    const { canvas } = rendreSlide(slides[i], i, slides.length, lotus, filigrane, reglages[i] ?? {});
    const suffixe = seulementLaPremiere ? "post" : String(i + 1).padStart(2, "0");
    await telecharger(canvas, `${base}-${suffixe}.png`);
    n += 1;
    await new Promise((r) => setTimeout(r, 260));
  }
  return n || aExporter.length;
}
