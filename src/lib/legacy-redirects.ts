/**
 * Anciennes adresses internes présentes dans des contenus publiés (corps
 * d'articles) mais qui ne correspondent à aucune page réelle. Chacune pointe
 * vers la page canonique existante. Utilisé à deux endroits :
 *  - le serveur répond 301 (ces liens ont été publics) ;
 *  - le rendu des articles réécrit directement le lien (pas de saut inutile).
 * Aucune nouvelle famille d'adresses n'est créée.
 */
const EXACT: Record<string, string> = {
  "/connexion": "/fr/connexion",
  "/de/therapeuten": "/de/therapeutes",
  "/en/practitioners": "/en/therapeutes",
  "/en/therapists": "/en/therapeutes",
  "/it/terapeuti": "/it/therapeutes",
  "/lithotherapie-suisse-cristaux-bien-etre-energetique": "/fr/blog/lithotherapie-suisse-cristaux-bien-etre-energetique",
  "/magnetisme-suisse": "/fr/specialites/magnetisme",
};

const SITE_RE = /^https?:\/\/(www\.)?holiswiss\.ch(?=\/|$)/i;

/** Cible canonique d'une ancienne adresse interne, sinon null. */
export function legacyRedirectTarget(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return EXACT[clean] ?? null;
}

/** Réécrit un lien d'article (relatif ou absolu holiswiss.ch) vers sa page réelle. */
export function rewriteLegacyHref(href: string): string {
  const m = href.match(SITE_RE);
  const rest = m ? href.slice(m[0].length) || "/" : href;
  if (!rest.startsWith("/")) return href;
  const [path, suffix = ""] = rest.split(/(?=[?#])/, 2);
  const target = legacyRedirectTarget(path);
  return target ? target + suffix : href;
}
