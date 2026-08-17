/**
 * Source de vérité unique du Title SEO d'une fiche thérapeute.
 * Utilisée par l'audit de visibilité, la page publique (head) et le
 * dashboard : la valeur auditée est exactement celle qui est publiée.
 */
export const SEO_TITLE_MIN = 20;
export const SEO_TITLE_MAX = 60;

export const cleanSeoTitle = (v?: string | null): string =>
  (v ?? "").replace(/\s+/g, " ").trim();

export type SeoTitleSource = "custom" | "generated" | "none";

export type SeoTitleResolution = {
  value: string;
  source: SeoTitleSource;
  length: number;
};

/** Titre effectif : valeur saisie si présente, sinon titre généré. */
export function resolveSeoTitle(
  metaTitle?: string | null,
  generated?: string | null,
): SeoTitleResolution {
  const custom = cleanSeoTitle(metaTitle);
  const auto = cleanSeoTitle(generated);
  const value = custom || auto;
  return {
    value,
    source: custom ? "custom" : auto ? "generated" : "none",
    length: [...value].length,
  };
}

const LANG_MARKERS: Record<string, RegExp> = {
  fr: /\b(th[ée]rapeute|praticien(ne)?|naturopathe|s[ée]ance|bien-[êe]tre|soins?)\b/i,
  de: /\b(therapeut(in)?|heilpraktiker(in)?|naturheilkunde|sitzung|behandlung)\b/i,
  it: /\b(terapista|terapeuta|naturopata|seduta|benessere)\b/i,
};

export type SeoTitleStatusCode =
  | "ok"
  | "missing"
  | "too_short"
  | "too_long"
  | "not_saved"
  | "not_published"
  | "lang_mismatch";

export type SeoTitleStatus = {
  passed: boolean;
  code: SeoTitleStatusCode;
  message: string;
  resolution: SeoTitleResolution;
};

/**
 * Applique la règle de longueur et explique précisément la cause d'un échec.
 * Un titre valide n'est jamais considéré comme manquant.
 */
export function evaluateSeoTitle(
  resolution: SeoTitleResolution,
  opts: { published?: boolean; expectedLang?: string | null } = {},
): SeoTitleStatus {
  const { value, source, length } = resolution;
  const fail = (code: SeoTitleStatusCode, message: string): SeoTitleStatus =>
    ({ passed: false, code, message, resolution });

  if (source === "none" || length === 0)
    return fail("missing", "Aucun titre SEO : renseignez-le (ou complétez nom, titre professionnel et ville pour le titre généré).");
  if (length < SEO_TITLE_MIN)
    return fail("too_short", `Titre SEO trop court (${length} caractères) : visez ${SEO_TITLE_MIN} à ${SEO_TITLE_MAX} caractères.`);
  if (length > SEO_TITLE_MAX)
    return fail("too_long", `Titre SEO trop long (${length} caractères) : Google le tronquera au-delà de ${SEO_TITLE_MAX} caractères.`);

  const expected = (opts.expectedLang ?? "").slice(0, 2).toLowerCase();
  if (source === "custom" && expected && LANG_MARKERS[expected]) {
    const matchesExpected = LANG_MARKERS[expected].test(value);
    const matchesOther = Object.entries(LANG_MARKERS)
      .some(([lang, re]) => lang !== expected && re.test(value));
    if (!matchesExpected && matchesOther)
      return fail("lang_mismatch", `Titre SEO rédigé dans une autre langue que celle attendue dans votre canton (${expected.toUpperCase()}).`);
  }

  if (opts.published === false)
    return fail("not_published", "Votre titre SEO est valide mais votre fiche n'est pas publiée : il n'apparaît pas encore dans les résultats de recherche.");

  return {
    passed: true,
    code: "ok",
    message: source === "custom"
      ? `Titre SEO validé (${length} caractères).`
      : `Titre SEO généré automatiquement et valide (${length} caractères).`,
    resolution,
  };
}

/** Titre généré par défaut, identique à celui de la page publique. */
export function buildGeneratedSeoTitle(input: {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  city?: string | null;
  canton?: string | null;
  /** Libellé de rôle déjà localisé (page publique). Sinon reconstruit ici. */
  roleLabel?: string | null;
}): string {
  const fullName = `${input.first_name ?? ""} ${input.last_name ?? ""}`.trim();
  if (!fullName) return "";
  const place = [input.city, input.canton].filter(Boolean).join(", ");
  const role =
    cleanSeoTitle(input.roleLabel) ||
    [input.title?.trim(), place ? `à ${place}` : ""].filter(Boolean).join(" ");
  return `${fullName}${role ? ` — ${role}` : ""} | Holiswiss`.slice(0, SEO_TITLE_MAX);
}
