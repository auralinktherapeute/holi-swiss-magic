/**
 * Source de vérité unique de la Meta description d'une fiche thérapeute.
 * Utilisée par la page publique (meta + Open Graph + JSON-LD), l'audit de
 * visibilité et l'aperçu SEO du dashboard : la valeur auditée est exactement
 * celle qui est publiée.
 */
export const SEO_DESC_MIN = 80;
export const SEO_DESC_MAX = 160;
/** Longueur de coupe appliquée au rendu HTML (Google tronque au-delà). */
export const SEO_DESC_TRUNCATE = 157;

export const cleanSeoDescription = (v?: string | null): string =>
  (v ?? "").replace(/\s+/g, " ").trim();

export type SeoDescriptionSource = "custom" | "bio" | "short_bio" | "generated" | "none";

export type SeoDescriptionResolution = {
  value: string;
  source: SeoDescriptionSource;
  length: number;
};

/**
 * Description effective, dans l'ordre exact utilisé par la page publique :
 * meta_description saisie → bio (si ≥ 50 caractères) → accroche → repli généré.
 */
export function resolveSeoDescription(input: {
  meta_description?: string | null;
  bio?: string | null;
  short_bio?: string | null;
  fallback?: string | null;
}): SeoDescriptionResolution {
  const custom = cleanSeoDescription(input.meta_description);
  const bio = cleanSeoDescription(input.bio);
  const shortBio = cleanSeoDescription(input.short_bio);
  const fallback = cleanSeoDescription(input.fallback);

  const pick: Array<[SeoDescriptionSource, string]> = [
    ["custom", custom],
    ["bio", bio.length >= 50 ? bio : ""],
    ["short_bio", shortBio.length >= 50 ? shortBio : ""],
    ["generated", fallback],
  ];
  const found = pick.find(([, v]) => v.length > 0);
  const value = found?.[1] ?? "";
  return { value, source: found?.[0] ?? "none", length: [...value].length };
}

/** Coupe propre appliquée au rendu HTML/OG/JSON-LD. */
export function truncateSeoDescription(value: string): string {
  const v = cleanSeoDescription(value);
  return v.length > SEO_DESC_TRUNCATE
    ? `${v.slice(0, SEO_DESC_TRUNCATE).replace(/\s+\S*$/, "")}…`
    : v;
}

export type SeoDescriptionStatusCode = "ok" | "missing" | "too_short" | "too_long" | "auto";

export type SeoDescriptionStatus = {
  passed: boolean;
  code: SeoDescriptionStatusCode;
  message: string;
  resolution: SeoDescriptionResolution;
};

/**
 * Règle unique de validation (même seuils dans le formulaire et dans l'audit) :
 * une description rédigée de 80 à 160 caractères. Une description héritée de la
 * bio est publiée mais n'est pas considérée comme maîtrisée.
 */
export function evaluateSeoDescription(
  resolution: SeoDescriptionResolution,
): SeoDescriptionStatus {
  const { value, source, length } = resolution;
  const fail = (code: SeoDescriptionStatusCode, message: string): SeoDescriptionStatus =>
    ({ passed: false, code, message, resolution });

  if (source === "none" || length === 0)
    return fail("missing", `Aucune meta description : sans elle, Google génère un extrait arbitraire. Rédigez ${SEO_DESC_MIN} à ${SEO_DESC_MAX} caractères.`);
  if (source !== "custom")
    return fail("auto", `Aucune meta description rédigée : Google affiche actuellement un extrait de votre présentation. Rédigez ${SEO_DESC_MIN} à ${SEO_DESC_MAX} caractères.`);
  if (length < SEO_DESC_MIN)
    return fail("too_short", `Meta description trop courte (${length} caractères) : visez ${SEO_DESC_MIN} à ${SEO_DESC_MAX} caractères.`);
  if (length > SEO_DESC_MAX)
    return fail("too_long", `Meta description trop longue (${length} caractères) : Google la tronquera au-delà de ${SEO_DESC_MAX} caractères.`);

  return {
    passed: true,
    code: "ok",
    message: `Meta description validée (${length} caractères).`,
    resolution,
  };
}
