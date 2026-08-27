/**
 * Réseaux sociaux du thérapeute — source unique de vérité.
 *
 * Règles :
 * - HTTPS obligatoire ;
 * - le domaine doit appartenir au réseau déclaré (pas de lien arbitraire) ;
 * - le lien reste stocké même lorsque l'affichage public est désactivé ;
 * - aucune icône n'est rendue sans URL valide ET affichage activé.
 */

export const SOCIAL_NETWORKS = ["instagram", "facebook", "linkedin"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export type SocialLink = { url: string; visible: boolean };
export type SocialLinks = Partial<Record<SocialNetwork, SocialLink>>;

export const SOCIAL_META: Record<
  SocialNetwork,
  { label: string; hosts: string[]; placeholder: string }
> = {
  instagram: {
    label: "Instagram",
    hosts: ["instagram.com", "instagr.am"],
    placeholder: "https://www.instagram.com/votre-compte",
  },
  facebook: {
    label: "Facebook",
    hosts: ["facebook.com", "fb.com", "fb.me", "m.facebook.com"],
    placeholder: "https://www.facebook.com/votre-page",
  },
  linkedin: {
    label: "LinkedIn",
    hosts: ["linkedin.com"],
    placeholder: "https://www.linkedin.com/in/votre-profil",
  },
};

function hostMatches(host: string, allowed: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return allowed.some((a) => h === a || h.endsWith(`.${a}`));
}

/** Retourne l'URL normalisée si elle est valide pour ce réseau, sinon `null`. */
export function normalizeSocialUrl(network: SocialNetwork, raw: string): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.length > 300) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!hostMatches(parsed.hostname, SOCIAL_META[network].hosts)) return null;
  // Un lien sans destination (racine du réseau) n'est pas un profil.
  if (parsed.pathname.replace(/\/+$/, "") === "") return null;
  return parsed.toString();
}

/** Message d'erreur utilisateur, ou `null` si l'URL est acceptable (vide inclus). */
export function socialUrlError(network: SocialNetwork, raw: string): string | null {
  if (!(raw ?? "").trim()) return null;
  return normalizeSocialUrl(network, raw)
    ? null
    : `Lien ${SOCIAL_META[network].label} invalide : utilisez une adresse https:// sur ${SOCIAL_META[network].hosts[0]}.`;
}

/** Nettoie une valeur venant de la base ou du formulaire. */
export function parseSocialLinks(raw: unknown): SocialLinks {
  const out: SocialLinks = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const network of SOCIAL_NETWORKS) {
    const entry = (raw as Record<string, unknown>)[network];
    if (!entry || typeof entry !== "object") continue;
    const url = normalizeSocialUrl(network, String((entry as any).url ?? ""));
    if (!url) continue;
    out[network] = { url, visible: (entry as any).visible === true };
  }
  return out;
}

/** Liens réellement affichables publiquement. */
export function publicSocialLinks(raw: unknown): Array<{ network: SocialNetwork; url: string }> {
  const parsed = parseSocialLinks(raw);
  return SOCIAL_NETWORKS.flatMap((network) => {
    const entry = parsed[network];
    return entry && entry.visible ? [{ network, url: entry.url }] : [];
  });
}
