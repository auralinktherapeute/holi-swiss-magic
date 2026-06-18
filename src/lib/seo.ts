/**
 * Centralized SEO helpers — multilingual canonical / hreflang / JSON-LD.
 * Pure data: no JSX, no DOM, no visual impact.
 */

export const SITE = "https://holiswiss.ch";
export const LANGS = ["fr", "de", "it", "en"] as const;
export type SeoLang = (typeof LANGS)[number];

/**
 * Build hreflang alternates + x-default for a path that contains the language
 * segment (e.g. "/therapeutes" or `/therapeute/${slug}`).
 * Path MUST start with "/" and MUST NOT include the language prefix.
 */
export function hreflangLinks(
  pathWithoutLang: string,
  defaultLang: SeoLang = "fr",
) {
  const clean = pathWithoutLang.startsWith("/") ? pathWithoutLang : `/${pathWithoutLang}`;
  const tail = clean === "/" ? "" : clean;
  const links = LANGS.map((l) => ({
    rel: "alternate" as const,
    hreflang: l,
    href: `${SITE}/${l}${tail}`,
  }));
  links.push({
    rel: "alternate" as const,
    hreflang: "x-default",
    href: `${SITE}/${defaultLang}${tail}`,
  });
  return links;
}

/** Canonical link object for a given lang + path-without-lang. */
export function canonicalLink(lang: string, pathWithoutLang: string) {
  const clean = pathWithoutLang.startsWith("/") ? pathWithoutLang : `/${pathWithoutLang}`;
  const tail = clean === "/" ? "" : clean;
  return { rel: "canonical" as const, href: `${SITE}/${lang}${tail}` };
}

/** Convenience: canonical + hreflang alternates in one array. */
export function seoLinks(lang: string, pathWithoutLang: string) {
  return [canonicalLink(lang, pathWithoutLang), ...hreflangLinks(pathWithoutLang)];
}

/** og:locale value for a given site language. */
export function ogLocale(lang: string) {
  switch (lang) {
    case "de":
      return "de_CH";
    case "it":
      return "it_CH";
    case "en":
      return "en_GB";
    default:
      return "fr_CH";
  }
}