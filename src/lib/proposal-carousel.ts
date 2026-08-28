import type { Carousel, CarouselLang, Slide } from "@/components/admin/CarouselViewer";

/**
 * Transforme une proposition marketing VALIDÉE en carrousel affichable.
 *
 * Une proposition ne contient qu'une caption par langue : on en dérive des
 * slides (accroche → corps → CTA) pour que toute proposition validée apparaisse
 * immédiatement dans l'onglet « Carrousels », sans étape manuelle.
 */

export type ProposalLike = {
  id: string;
  network: string;
  pillar: string | null;
  angle: string | null;
  format: string | null;
  caption: string;
  caption_en: string | null;
  caption_de: string | null;
  caption_it: string | null;
  hashtags: string | null;
  hashtags_en: string | null;
  hashtags_de: string | null;
  hashtags_it: string | null;
  visual_brief: string | null;
  lang: string;
  status: string;
  validated_at?: string | null;
  published_at?: string | null;
  proposal_date?: string | null;
  created_at: string;
  carousel_page_count?: number | null;
  carousel_presentation?: string | null;
};

const LANGS: CarouselLang[] = ["fr", "de", "it", "en"];

function firstSentence(text: string): { head: string; rest: string } {
  const m = text.match(/^([\s\S]{0,140}?[.!?…»])\s+([\s\S]+)$/);
  if (!m) return { head: text, rest: "" };
  return { head: m[1]!.trim(), rest: m[2]!.trim() };
}

function splitLongestBlock(blocks: string[]): string[] {
  const longestIndex = blocks.reduce(
    (best, block, index) => (block.length > blocks[best]!.length ? index : best),
    0,
  );
  const block = blocks[longestIndex]!;
  const sentences = block.match(/[^.!?…]+[.!?…]?/g)?.map((part) => part.trim()).filter(Boolean) ?? [];

  let left = "";
  let right = "";
  if (sentences.length > 1) {
    const middle = Math.ceil(sentences.length / 2);
    left = sentences.slice(0, middle).join(" ");
    right = sentences.slice(middle).join(" ");
  } else {
    const words = block.split(/\s+/).filter(Boolean);
    const middle = Math.max(1, Math.ceil(words.length / 2));
    left = words.slice(0, middle).join(" ");
    right = words.slice(middle).join(" ");
  }

  if (!right) right = left;
  return [...blocks.slice(0, longestIndex), left, right, ...blocks.slice(longestIndex + 1)];
}

function forceBlockCount(source: string[], pageCount: number): string[] {
  let blocks = source.length ? source : [""];
  while (blocks.length < pageCount) blocks = splitLongestBlock(blocks);
  if (blocks.length === pageCount) return blocks;

  return Array.from({ length: pageCount }, (_, index) => {
    const start = Math.floor((index * blocks.length) / pageCount);
    const end = Math.floor(((index + 1) * blocks.length) / pageCount);
    return blocks.slice(start, Math.max(start + 1, end)).join(" ");
  });
}

/**
 * Découpe une caption en slides lisibles (8 max, comme les carrousels produits).
 * Si `pageCount` est fourni, le résultat contient toujours exactement ce nombre
 * de pages, y compris pour les anciennes captions structurées en davantage de blocs.
 */
export function captionToSlides(caption: string, pageCount?: number | null): Slide[] {
  if (pageCount && pageCount >= 2) {
    const sourceBlocks = caption
      .split(/\n\s*\n/)
      .map((p) => p.replace(/#[^\s#]+/g, "").trim())
      .filter((p) => p.length > 1);
    const blocks = forceBlockCount(sourceBlocks, pageCount);
    return blocks.map((b, i) => {
      const s = firstSentence(b);
      const kind: Slide["kind"] = i === 0 ? "hook" : i === blocks.length - 1 ? "cta" : "body";
      return { kind, title: s.head, body: s.rest || undefined };
    });
  }

  const paras = caption
    .split(/\n{2,}|\n/)
    .map((p) => p.replace(/#[^\s#]+/g, "").trim())
    .filter((p) => p.length > 1);
  if (!paras.length) return [{ kind: "hook", title: caption.slice(0, 120) }];

  const slides: Slide[] = [];
  const first = firstSentence(paras[0]!);
  slides.push({ kind: "hook", title: first.head, body: first.rest || undefined });

  const middle = paras.slice(1, paras.length > 1 ? -1 : undefined);
  for (const p of middle.slice(0, 6)) {
    const s = firstSentence(p);
    slides.push({ kind: "body", title: s.head, body: s.rest || undefined });
  }

  if (paras.length > 1) {
    const last = firstSentence(paras[paras.length - 1]!);
    slides.push({ kind: "cta", title: last.head, body: last.rest || undefined });
  }
  return slides;
}

const PILLAR_LABEL: Record<string, string> = {
  standard: "Le Standard",
  chaise_en_face: "La Chaise d'en face",
  concret_suisse: "Le Concret suisse",
  preuve: "La Preuve",
  preuve_sociale: "Preuve sociale",
  educatif: "Éducatif",
  demo_outil: "Démo d'outil",
  marque: "Marque",
};

export function proposalToCarousel(p: ProposalLike): Carousel {
  const captions: Partial<Record<CarouselLang, string>> = {
    fr: p.caption,
    en: p.caption_en ?? undefined,
    de: p.caption_de ?? undefined,
    it: p.caption_it ?? undefined,
  };
  const hashtags: Partial<Record<CarouselLang, string>> = {
    fr: p.hashtags ?? undefined,
    en: p.hashtags_en ?? undefined,
    de: p.hashtags_de ?? undefined,
    it: p.hashtags_it ?? undefined,
  };

  const origine = (LANGS.includes(p.lang as CarouselLang) ? p.lang : "fr") as CarouselLang;
  const pages = p.carousel_page_count ?? null;
  const baseSlides = captionToSlides(captions[origine] ?? p.caption, pages);
  const slides = LANGS.reduce(
    (acc, l) => {
      const c = captions[l];
      acc[l] = c ? captionToSlides(c, pages) : baseSlides;
      return acc;
    },
    {} as Record<CarouselLang, Slide[]>,
  );

  const titre = (p.angle ?? p.caption).slice(0, 90).replace(/\s+\S*$/, "") || "Proposition validée";
  const date = (p.validated_at ?? p.published_at ?? p.proposal_date ?? p.created_at).slice(0, 10);

  return {
    id: `proposal-${p.id}`,
    pilier: PILLAR_LABEL[p.pillar ?? ""] ?? p.pillar ?? "Proposition validée",
    titre,
    score: 100,
    date,
    langueOrigine: origine,
    lectureTherapeute: p.visual_brief ?? "Proposition validée depuis l'onglet Propositions.",
    lecturePatient: p.format ? `Format : ${p.format} · ${p.network}` : p.network,
    slides,
    hashtags,
    caption: captions,
  };
}

/** Vrai si le carrousel a plus de `days` jours (archivage). */
export function isArchived(c: Carousel, days = 7, now = Date.now()): boolean {
  if (!c.date) return false;
  const t = new Date(`${c.date}T00:00:00Z`).getTime();
  if (Number.isNaN(t)) return false;
  return now - t > days * 86_400_000;
}
