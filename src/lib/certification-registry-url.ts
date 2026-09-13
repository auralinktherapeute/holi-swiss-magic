/**
 * Référence facultative vers la fiche officielle d'un organisme (ASCA, RME/EMR)
 * fournie par le thérapeute.
 *
 * Le lien n'est JAMAIS récupéré côté serveur : aucun `fetch`, aucun appel de
 * registre, aucun scraping. Il sert uniquement à faire gagner du temps à
 * l'administrateur, qui l'ouvre lui-même et note le résultat de son contrôle.
 *
 * Contrôles appliqués (client ET serveur, la valeur cliente n'est jamais crue) :
 * - protocole `https:` exclusivement ;
 * - hôte appartenant exactement à la liste des domaines officiels
 *   (avec ou sans `www.`) — un sous-domaine ou un domaine ressemblant est refusé ;
 * - aucun identifiant dans l'URL (`user:pass@`), aucun port ;
 * - fragment `#…` retiré (il ne sert à rien pour un contrôle et peut masquer
 *   la fin de l'URL affichée).
 */

/** Domaines officiels acceptés, en minuscules, sans `www.`. */
export const OFFICIAL_REGISTRY_DOMAINS = ["asca.ch", "rme.ch", "emr.ch"] as const;

export const OFFICIAL_REGISTRY_DOMAINS_LABEL = "asca.ch, rme.ch, emr.ch";

export type RegistryUrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; error: string };

export function validateRegistryUrl(raw: string | null | undefined): RegistryUrlCheck {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Aucun lien fourni." };
  if (value.length > 2000) return { ok: false, error: "Lien trop long (2000 caractères maximum)." };

  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return { ok: false, error: "Lien illisible. Copiez l'adresse complète depuis votre navigateur." };
  }

  if (u.protocol !== "https:") return { ok: false, error: "Le lien doit commencer par https://" };
  if (u.username || u.password) return { ok: false, error: "Le lien ne doit pas contenir d'identifiants." };
  if (u.port) return { ok: false, error: "Le lien ne doit pas contenir de port." };

  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!(OFFICIAL_REGISTRY_DOMAINS as readonly string[]).includes(host)) {
    return {
      ok: false,
      error: `Seules les adresses officielles sont acceptées : ${OFFICIAL_REGISTRY_DOMAINS_LABEL}.`,
    };
  }

  u.hash = "";
  return { ok: true, url: u.toString(), host };
}

/** true si l'URL déjà enregistrée reste sûre à afficher en lien cliquable. */
export function isSafeRegistryUrl(raw: string | null | undefined): boolean {
  return validateRegistryUrl(raw).ok;
}
