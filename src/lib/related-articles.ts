/**
 * Sélection des « articles connexes » d'une page article — fonction pure.
 * Priorité : même catégorie, puis tags secondaires partagés, puis les plus
 * récents pour compléter. L'article courant est toujours exclu. Hors FR, seuls
 * les articles disposant d'un titre dans la langue sont retenus (jamais un
 * titre français affiché sur /de, /it, /en).
 */
export type RelatedLang = "fr" | "de" | "it" | "en";

export type RelatedArticleLink = {
  id: string;
  slug: string;
  title: string;
  category: string | null;
};

export const RELATED_MIN = 3;
export const RELATED_MAX = 5;

type Row = Record<string, unknown>;

const tagsOf = (a: Row): string[] =>
  ((a.secondary_tags as string[] | null) ?? []).filter((t): t is string => typeof t === "string" && !!t);

export function pickRelatedArticles(
  current: Row,
  candidates: ReadonlyArray<Row>,
  lang: RelatedLang,
  max = RELATED_MAX,
): RelatedArticleLink[] {
  const curCat = (current.category as string | null) ?? null;
  const curTags = new Set(tagsOf(current));
  const curId = current.id;
  const curSlug = current.slug;

  const scored = candidates
    .map((a, index) => {
      if ((curId && a.id === curId) || (curSlug && a.slug === curSlug)) return null;
      const title = ((lang === "fr" ? a.title_fr : a[`title_${lang}`]) as string | null)?.trim();
      const slug = ((a[`slug_${lang}`] as string) || (a.slug as string) || "").trim();
      if (!title || !slug) return null;
      const cat = (a.category as string | null) ?? null;
      const tags = tagsOf(a);
      let score = 0;
      if (curCat && cat === curCat) score += 100;
      else if (curCat && tags.includes(curCat)) score += 50;
      for (const t of tags) if (curTags.has(t)) score += 10;
      if (cat && curTags.has(cat)) score += 10;
      return { link: { id: String(a.id ?? slug), slug, title, category: cat }, score, index };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Tri stable : score décroissant, puis ordre d'origine (déjà du plus récent au plus ancien).
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.slice(0, max).map((s) => s.link);
}
