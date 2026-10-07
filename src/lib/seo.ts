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

/**
 * Restreint des alternates aux langues indexables. Moins de deux langues :
 * aucun hreflang (x-default inclus). `undefined` = toutes (panne, cas sûr).
 */
export function listingAlternates<T extends { hrefLang: string }>(
  links: T[],
  langs: readonly string[] | undefined,
): T[] {
  if (!langs) return links;
  if (langs.length < 2) return [];
  return links.filter((l) => (l.hrefLang === "x-default" ? langs.includes("fr") : langs.includes(l.hrefLang)));
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
 * Normalise un code de langue vers fr/de/it/en : « fr-CH », « FR », « de_CH »,
 * «  it  » sont acceptés ; tout le reste (« french », « es », vide) → null.
 */
export function normalizeSeoLang(value: unknown): SeoLang | null {
  if (typeof value !== "string") return null;
  const base = value.trim().toLowerCase().split(/[-_]/)[0];
  return (LANGS as readonly string[]).includes(base) ? (base as SeoLang) : null;
}

/**
 * Langue de RÉDACTION d'une fiche, lue dans `therapists.profile_translations`.
 *
 * `source_lang` est détecté par le modèle au moment de la traduction. Mais un
 * profil encore vide reçoit `source_lang: "fr"` PAR DÉFAUT, sans détection
 * (`translateTherapistRow`, branche « aucun champ ») : on ne s'y fie donc que
 * si au moins une traduction a été produite (`langs` non vide), preuve que la
 * détection a eu lieu. Sinon → null, et la règle canton / langues parlées
 * reprend la main.
 */
export function profileSourceLang(profileTranslations: unknown): SeoLang | null {
  if (!profileTranslations || typeof profileTranslations !== "object") return null;
  const tr = profileTranslations as { source_lang?: unknown; langs?: unknown };
  const detected =
    !!tr.langs && typeof tr.langs === "object" && Object.keys(tr.langs as object).length > 0;
  return detected ? normalizeSeoLang(tr.source_lang) : null;
}

/**
 * Langue principale d'une fiche, par ordre de priorité :
 *   1. la langue de l'URL (c'est la version consultée — libellés, FAQ auto) ;
 *   2. la langue de rédaction (`sourceLang`, cf. `profileSourceLang`) ;
 *   3. la langue officielle du canton ;
 *   4. la première langue parlée reconnue (« Français », « de-CH »…) ;
 *   5. le français.
 * Le canton ne sert qu'en repli : une fiche rédigée en français à Bâle reste
 * française, sa version allemande n'est qu'une traduction automatique.
 */
export function resolveProfileLang(
  urlLang?: string | null,
  canton?: string | null,
  spokenLanguages?: string[] | null,
  sourceLang?: string | null,
): SeoLang {
  const u = (urlLang ?? "").slice(0, 2) as SeoLang;
  if (LANGS.includes(u)) return u;
  const src = normalizeSeoLang(sourceLang);
  if (src) return src;
  const c = CANTON_LANG[(canton ?? "").trim().toUpperCase()];
  if (c) return c;
  const s = (spokenLanguages ?? [])
    .map((l) => String(l ?? "").trim().slice(0, 2).toLowerCase())
    .find((l) => LANGS.includes(l as SeoLang));
  return (s as SeoLang) ?? "fr";
}

/** Les colonnes de `therapists` dont dépend la langue indexable d'une fiche. */
export const PROFILE_LANG_COLUMNS = "canton,languages,profile_translations" as const;

export type ProfileLangSource = {
  canton?: string | null;
  languages?: string[] | null;
  profile_translations?: unknown;
};

/**
 * Langue indexable (canonique) d'une fiche, indépendante de l'URL consultée.
 * SEULE source de vérité pour le canonical de la fiche, son URL de sitemap et
 * les liens canoniques vers la fiche (auteur d'une parole, organisateur d'un
 * événement) : ne jamais recomposer cette règle ailleurs.
 */
export function profileContentLang(row: ProfileLangSource | null | undefined): SeoLang {
  return resolveProfileLang(
    null,
    row?.canton ?? null,
    row?.languages ?? null,
    profileSourceLang(row?.profile_translations),
  );
}

/** URL canonique absolue d'une fiche praticien. */
export function profileCanonicalUrl(slug: string, row: ProfileLangSource | null | undefined): string {
  return `${SITE}/${profileContentLang(row)}/therapeute/${slug}`;
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
