/**
 * Mapping léger des slugs de la page pilier « visibilité ».
 *
 * Module volontairement minuscule et sans contenu éditorial : il est importé
 * par la navigation (LanguageSwitcher) pour que le changement de langue mène à
 * la bonne variante d'URL, sans embarquer les textes trilingues dans le bundle
 * de navigation. `visibility-pillar-content.ts` réutilise ces mêmes valeurs :
 * il n'existe donc qu'une seule source de vérité pour les slugs.
 */

export const PILLAR_SLUGS = {
  fr: "visibilite-therapeute-suisse",
  de: "sichtbarkeit-therapeuten-schweiz",
  it: "visibilita-terapeuti-svizzera",
} as const;

export type PillarSlugLang = keyof typeof PILLAR_SLUGS;

const SLUG_VALUES = Object.values(PILLAR_SLUGS) as string[];

export function isPillarSlug(slug: string | undefined): boolean {
  return !!slug && SLUG_VALUES.includes(slug);
}

/**
 * Si `pathname` est une page pilier, renvoie le chemin équivalent dans
 * `targetLang` (accueil de la langue si aucune traduction n'existe, ex. `en`).
 * Renvoie `null` pour toute autre route : le comportement existant est alors
 * conservé tel quel.
 */
export function mapPillarPath(pathname: string, targetLang: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || !isPillarSlug(segments[1])) return null;
  const slug = PILLAR_SLUGS[targetLang as PillarSlugLang];
  return slug ? `/${targetLang}/${slug}` : `/${targetLang}`;
}
