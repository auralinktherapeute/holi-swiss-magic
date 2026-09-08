import type { Slide } from "@/components/admin/CarouselViewer";

/**
 * Condense un carrousel déjà produit en un nombre de pages plus petit,
 * sans rien perdre du texte : les pages fusionnées voient leur contenu
 * regroupé (titre conservé, reste versé dans le corps).
 *
 * Purement présentationnel : n'écrit rien en base, la source reste intacte.
 */

/**
 * Texte d'une page fusionnée, hors puces et hors avertissement : ceux-ci sont
 * regroupés séparément pour ne jamais apparaître deux fois.
 */
function texteDe(s: Slide): string {
  return [s.label, s.title, s.body]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .map((v) => v.trim())
    .join("\n");
}

function fusionner(groupe: Slide[]): Slide {
  const premiere = groupe[0]!;
  if (groupe.length === 1) return premiere;

  const suite = groupe
    .slice(1)
    .map(texteDe)
    .filter(Boolean)
    .join("\n\n");

  const puces = groupe.flatMap((s) => s.items ?? []).filter((v) => !!v && v.trim().length > 0);
  const avertissements = [...new Set(groupe.map((s) => s.warn).filter((v): v is string => !!v))];

  return {
    kind: premiere.kind,
    label: premiere.label,
    title: premiere.title,
    body: [premiere.body?.trim(), suite].filter(Boolean).join("\n\n") || undefined,
    items: puces.length ? puces : undefined,
    warn: avertissements.length ? avertissements.join(" · ") : undefined,
  };
}

/** Découpe `n` éléments en `parts` groupes contigus, aussi équilibrés que possible. */
function grouper<T>(items: T[], parts: number): T[][] {
  const n = items.length;
  return Array.from({ length: parts }, (_, i) =>
    items.slice(Math.floor((i * n) / parts), Math.floor(((i + 1) * n) / parts)),
  ).filter((g) => g.length > 0);
}

export function condenseSlides(slides: Slide[], pageCount: number): Slide[] {
  if (!Number.isFinite(pageCount) || pageCount < 1) return slides;
  if (slides.length <= pageCount) return slides;
  if (pageCount === 1) return [fusionner(slides)];

  const premiere = slides[0]!;
  const derniere = slides[slides.length - 1]!;
  const milieu = slides.slice(1, -1);

  if (pageCount === 2) {
    const coupe = Math.ceil(milieu.length / 2);
    return [
      fusionner([premiere, ...milieu.slice(0, coupe)]),
      { ...fusionner([...milieu.slice(coupe), derniere]), kind: derniere.kind },
    ];
  }

  const groupes = grouper(milieu, pageCount - 2).map(fusionner);
  return [premiere, ...groupes, derniere];
}
