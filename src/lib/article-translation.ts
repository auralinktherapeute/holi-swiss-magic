/**
 * Règle unique « traduction complète » d'un article de blog, par langue.
 *
 * Lue par la page article (robots, canonical, hreflang) ET par le sitemap :
 * une variante incomplète n'est ni déclarée, ni indexable, et sa canonical
 * consolide vers la version source FR. Aucun repli français silencieux n'est
 * considéré comme une traduction.
 */
export const ARTICLE_LANGS = ["fr", "de", "it", "en"] as const;
export type ArticleLang = (typeof ARTICLE_LANGS)[number];

/** Colonnes nécessaires au calcul (à inclure dans tout `select`). */
export const TRANSLATION_COLUMNS = [
  "slug",
  "slug_de",
  ...ARTICLE_LANGS.flatMap((l) => [
    `title_${l}`,
    `excerpt_${l}`,
    `body_${l}`,
    ...(l === "fr" ? ["meta_title_fr", "meta_description_fr"] : [`meta_title_${l}`, `meta_description_${l}`]),
  ]),
].join(", ");

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MARKDOWN_IN_LINE = /(^|\s)#{1,6}(\s|$)|\*\*|__|^\s*[-*>]\s/;

/** Mots-outils français très fréquents, rares en DE/IT/EN. */
const FR_STOPWORDS = new Set([
  "les", "des", "est", "une", "pour", "avec", "vous", "dans", "qui", "que", "sur", "pas", "sont", "aux", "votre", "cette", "mais", "plus", "être",
]);

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Part de mots-outils français dans un texte (0..1). */
export function frenchRatio(text: string): number {
  const words = text.toLowerCase().normalize("NFC").match(/[a-zàâçéèêëîïôûùüÿœ]+/g) ?? [];
  if (words.length === 0) return 0;
  let fr = 0;
  for (const w of words) if (FR_STOPWORDS.has(w)) fr++;
  return fr / words.length;
}

/** Retire les marqueurs Markdown d'une ligne de titre ou de méta (« ## Titre » → « Titre »). */
export function cleanInlineText(s: string): string {
  return s
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugForArticleLang(a: Record<string, unknown>, lang: ArticleLang): string {
  return str(a[`slug_${lang}`]) || str(a.slug);
}

export type TranslationCheck = { complete: boolean; reasons: string[] };

export function checkTranslation(a: Record<string, unknown>, lang: ArticleLang): TranslationCheck {
  const reasons: string[] = [];
  const title = str(a[`title_${lang}`]);
  const excerpt = str(a[`excerpt_${lang}`]);
  const body = str(a[`body_${lang}`]);
  const metaTitle = str(a[`meta_title_${lang}`]);
  const metaDesc = str(a[`meta_description_${lang}`]);
  const slug = slugForArticleLang(a, lang);

  if (!title) reasons.push("titre manquant");
  if (!body) reasons.push("corps manquant");
  if (!excerpt) reasons.push("résumé manquant");
  if (lang !== "fr") {
    if (!metaTitle) reasons.push("meta title manquant");
    if (!metaDesc) reasons.push("meta description manquante");
  }
  if (!SLUG_RE.test(slug)) reasons.push("slug invalide");
  for (const [k, v] of [["titre", title], ["meta title", metaTitle], ["meta description", metaDesc]] as const) {
    if (v && MARKDOWN_IN_LINE.test(v)) reasons.push(`Markdown dans ${k}`);
  }

  if (lang !== "fr") {
    const fr = (k: string) => str(a[`${k}_fr`]);
    if (title && title === fr("title")) reasons.push("titre identique au français");
    if (body && body === fr("body")) reasons.push("corps identique au français");
    if (excerpt && excerpt === fr("excerpt")) reasons.push("résumé identique au français");
    if (body && fr("body") && body.length < fr("body").length * 0.6) reasons.push("corps nettement plus court que le français");
    for (const [k, v] of [["titre", title], ["résumé", excerpt], ["corps", body], ["meta description", metaDesc]] as const) {
      if (v && frenchRatio(v) > 0.08) reasons.push(`français résiduel (${k})`);
    }
  }
  return { complete: reasons.length === 0, reasons };
}

export function isTranslationComplete(a: Record<string, unknown>, lang: ArticleLang): boolean {
  return checkTranslation(a, lang).complete;
}

/** Langues réellement publiables (FR source toujours en tête si complète). */
export function completeLangs(a: Record<string, unknown>): ArticleLang[] {
  return ARTICLE_LANGS.filter((l) => isTranslationComplete(a, l));
}

const SITE = "https://holiswiss.ch";

export function articleUrl(a: Record<string, unknown>, lang: ArticleLang): string {
  return `${SITE}/${lang}/blog/${slugForArticleLang(a, lang)}`;
}

/**
 * Métadonnées d'indexation d'une variante : canonical, robots et hreflang
 * réciproques (variantes complètes uniquement + x-default FR).
 */
export function articleIndexing(a: Record<string, unknown>, lang: ArticleLang) {
  const langs = completeLangs(a);
  const complete = langs.includes(lang);
  const alternates = langs.length > 0 ? [
    ...langs.map((l) => ({ hreflang: l as string, href: articleUrl(a, l) })),
    { hreflang: "x-default", href: articleUrl(a, langs.includes("fr") ? "fr" : langs[0]) },
  ] : [];
  return {
    complete,
    robots: complete ? "index,follow" : "noindex,follow",
    canonical: complete ? articleUrl(a, lang) : articleUrl(a, "fr"),
    alternates: complete ? alternates : [],
  };
}
