export type HoliswissAuthSpace = "login" | "admin" | "dashboard";

export const ACTIVE_AUTH_SPACE_KEY = "holiswiss-active-auth-space";
export const LAST_AUTH_SPACE_KEY = "holiswiss-last-auth-space";

export const HOLISWISS_AUTH_SPACES: HoliswissAuthSpace[] = ["login", "admin", "dashboard"];

const validSpaces = new Set<HoliswissAuthSpace>(["login", "admin", "dashboard"]);

export function isHoliswissAuthSpace(value: unknown): value is HoliswissAuthSpace {
  return typeof value === "string" && validSpaces.has(value as HoliswissAuthSpace);
}

/**
 * Détermine l'espace d'authentification actuel.
 * La priorité est donnée à l'URL (source de vérité pour la navigation),
 * puis à la session en cours, puis au dernier espace connu.
 */
export function getHoliswissAuthSpace(): HoliswissAuthSpace {
  if (typeof window === "undefined") return "dashboard";
  try {
    const path = window.location.pathname;
    
    // 1. L'URL est prioritaire pour éviter les désynchronisations lors d'une navigation directe
    if (path.startsWith("/admin")) return "admin";
    if (path.startsWith("/dashboard")) return "dashboard";
    if (path.includes("/connexion")) return "login";

    // 2. Session active (persistante uniquement pour la durée de l'onglet)
    const active = window.sessionStorage.getItem(ACTIVE_AUTH_SPACE_KEY);
    if (isHoliswissAuthSpace(active)) return active;

    // 3. Dernier espace connu (persistant entre les sessions)
    const last = window.localStorage.getItem(LAST_AUTH_SPACE_KEY);
    if (isHoliswissAuthSpace(last)) return last;
  } catch {
    // Ignore unavailable storage (private mode, Safari restrictions, etc.).
  }
  return "dashboard";
}

export function setHoliswissAuthSpace(space: HoliswissAuthSpace) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACTIVE_AUTH_SPACE_KEY, space);
    if (space !== "login") {
      window.localStorage.setItem(LAST_AUTH_SPACE_KEY, space);
    }
  } catch {
    // The auth client still works with its current in-memory session.
  }
}

export function clearHoliswissAuthSpace() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACTIVE_AUTH_SPACE_KEY);
    window.localStorage.removeItem(LAST_AUTH_SPACE_KEY);
  } catch {}
}

export function getHoliswissAuthStorageKey(space: HoliswissAuthSpace) {
  return `holiswiss-${space}-auth-token`;
}

export function clearStoredSupabaseSession(space: HoliswissAuthSpace) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getHoliswissAuthStorageKey(space));
    // Safari peut parfois garder des traces en sessionStorage si le client y a accès
    window.sessionStorage.removeItem(getHoliswissAuthStorageKey(space));
  } catch {}
}

export function clearStoredSupabaseSessions(spaces: HoliswissAuthSpace[] = HOLISWISS_AUTH_SPACES) {
  if (typeof window === "undefined") return;
  for (const space of spaces) {
    clearStoredSupabaseSession(space);
  }
}

export function clearLegacySupabaseSessions() {
  if (typeof window === "undefined") return;
  try {
    // Nettoyage agressif des jetons standards Supabase pour éviter les conflits
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith("sb-") || key.includes("-auth-token"))) {
        // On ne supprime que si ce n'est pas une de NOS clés gérées
        if (!HOLISWISS_AUTH_SPACES.some(s => key === getHoliswissAuthStorageKey(s))) {
          window.localStorage.removeItem(key);
        }
      }
    }
  } catch {}
}

/** Vrai si un jeton de session est présent dans l'un des espaces connus. */
export function hasStoredSupabaseSession() {
  if (typeof window === "undefined") return false;
  try {
    return HOLISWISS_AUTH_SPACES.some((space) =>
      Boolean(window.localStorage.getItem(getHoliswissAuthStorageKey(space))),
    );
  } catch {
    return false;
  }
}
