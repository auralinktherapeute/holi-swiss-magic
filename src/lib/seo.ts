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
  const links: Array<{ rel: "alternate"; hrefLang: string; href: string }> = LANGS.map((l) => ({
    rel: "alternate",
    hrefLang: l,
    href: `${SITE}/${l}${tail}`,
  }));
  links.push({ rel: "alternate", hrefLang: "x-default", href: `${SITE}/${defaultLang}${tail}` });
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
/** Langue officielle dominante par canton (base du SEO local). */
const CANTON_LANG: Record<string, SeoLang> = {
  GE: "fr", VD: "fr", NE: "fr", JU: "fr", VS: "fr", FR: "fr",
  BE: "de", ZH: "de", BS: "de", BL: "de", AG: "de", SO: "de", LU: "de",
  SG: "de", TG: "de", SH: "de", ZG: "de", SZ: "de", OW: "de", NW: "de",
  UR: "de", GL: "de", AR: "de", AI: "de", GR: "de",
  TI: "it",
};

/**
 * Langue principale d'une fiche : la langue de l'URL prime (c'est la version
 * consultée), sinon le canton, sinon la première langue parlée déclarée.
 */
export function resolveProfileLang(
  urlLang?: string | null,
  canton?: string | null,
  spokenLanguages?: string[] | null,
): SeoLang {
  const u = (urlLang ?? "").slice(0, 2) as SeoLang;
  if (LANGS.includes(u)) return u;
  const c = CANTON_LANG[(canton ?? "").trim().toUpperCase()];
  if (c) return c;
  const s = (spokenLanguages ?? [])
    .map((l) => l.slice(0, 2))
    .find((l) => LANGS.includes(l as SeoLang));
  return (s as SeoLang) ?? "fr";
}

/** Langue officielle du canton, indépendamment de la version consultée. */
export function cantonLang(canton?: string | null): SeoLang | null {
  return CANTON_LANG[(canton ?? "").trim().toUpperCase()] ?? null;
}

type ProfileCopy = {
  role: (title: string | undefined | null, place: string) => string;
  fallbackRole: string;
  descFallback: (name: string, role: string) => string;
  breadcrumbHome: string;
  breadcrumbList: string;
  genericTitle: string;
  genericDescription: string;
};

const PROFILE_COPY: Record<SeoLang, ProfileCopy> = {
  fr: {
    role: (title, place) => [title, place ? `à ${place}` : ""].filter(Boolean).join(" "),
    fallbackRole: "Thérapeute",
    descFallback: (n, r) => `Profil de ${n}${r ? `, ${r}` : ""}. Prenez rendez-vous sur Holiswiss.`,
    breadcrumbHome: "Accueil",
    breadcrumbList: "Thérapeutes",
    genericTitle: "Thérapeute — Holiswiss",
    genericDescription: "Découvrez ce thérapeute holistique sur Holiswiss, l'annuaire des praticiens en Suisse.",
  },
  de: {
    role: (title, place) => [title, place ? `in ${place}` : ""].filter(Boolean).join(" "),
    fallbackRole: "Therapeut",
    descFallback: (n, r) => `Profil von ${n}${r ? `, ${r}` : ""}. Jetzt Termin buchen auf Holiswiss.`,
    breadcrumbHome: "Startseite",
    breadcrumbList: "Therapeuten",
    genericTitle: "Therapeut — Holiswiss",
    genericDescription: "Entdecken Sie diesen ganzheitlichen Therapeuten auf Holiswiss, dem Verzeichnis der Praktiker in der Schweiz.",
  },
  it: {
    role: (title, place) => [title, place ? `a ${place}` : ""].filter(Boolean).join(" "),
    fallbackRole: "Terapeuta",
    descFallback: (n, r) => `Profilo di ${n}${r ? `, ${r}` : ""}. Prenota su Holiswiss.`,
    breadcrumbHome: "Home",
    breadcrumbList: "Terapeuti",
    genericTitle: "Terapeuta — Holiswiss",
    genericDescription: "Scopri questo terapeuta olistico su Holiswiss, la directory dei professionisti in Svizzera.",
  },
  en: {
    role: (title, place) => [title, place ? `in ${place}` : ""].filter(Boolean).join(" "),
    fallbackRole: "Therapist",
    descFallback: (n, r) => `Profile of ${n}${r ? `, ${r}` : ""}. Book an appointment on Holiswiss.`,
    breadcrumbHome: "Home",
    breadcrumbList: "Therapists",
    genericTitle: "Therapist — Holiswiss",
    genericDescription: "Discover this holistic practitioner on Holiswiss, the Swiss directory of therapists.",
  },
};

export function profileCopy(lang: string): ProfileCopy {
  return PROFILE_COPY[(lang.slice(0, 2) as SeoLang)] ?? PROFILE_COPY.fr;
}
