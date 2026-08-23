/**
 * Redirections 301 permanentes entre anciens slugs d'articles et leur URL cible.
 * Utilisé par le loader de /$lang/blog/$slug (SSR → vrai 301 pour Google).
 * Clé = ancien slug, valeur = slug cible.
 */
export const BLOG_SLUG_REDIRECTS: Record<string, string> = {
  // Fusion du cluster "remboursement LAMal & assurances complémentaires"
  "remboursement-lamal-assurances-complementaires-therapies-holistiques-suisse":
    "remboursement-asca-rme-naturopathie-acupuncture-suisse",
  "remboursement-lamal-naturopathie-acupuncture-canton-suisse":
    "remboursement-asca-rme-naturopathie-acupuncture-suisse",
  "remboursement-osteopathie-suisse-2024-lamal":
    "remboursement-asca-rme-naturopathie-acupuncture-suisse",
  "therapies-remboursees-suisse-lamal":
    "remboursement-asca-rme-naturopathie-acupuncture-suisse",
};

export function redirectTargetForSlug(slug: string): string | null {
  const target = BLOG_SLUG_REDIRECTS[slug];
  return target && target !== slug ? target : null;
}
