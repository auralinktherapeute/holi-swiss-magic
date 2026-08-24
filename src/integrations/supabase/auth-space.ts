export type HoliswissAuthSpace = "login" | "admin" | "dashboard";

export const ACTIVE_AUTH_SPACE_KEY = "holiswiss-active-auth-space";
export const LAST_AUTH_SPACE_KEY = "holiswiss-last-auth-space";
export const AUTH_SPACE_CHANGE_EVENT = "holiswiss-auth-space-change";

export const HOLISWISS_AUTH_SPACES: HoliswissAuthSpace[] = ["login", "admin", "dashboard"];

const validSpaces = new Set<HoliswissAuthSpace>(["login", "admin", "dashboard"]);

export function isHoliswissAuthSpace(value: unknown): value is HoliswissAuthSpace {
  return typeof value === "string" && validSpaces.has(value as HoliswissAuthSpace);
}

/**
 * Détermine l'espace d'authentification actuel.
 * Les routes protégées imposent leur espace. Sur les routes publiques comme
 * /connexion, l'espace actif explicite reste prioritaire afin que la migration
 * login → admin/dashboard cible bien le nouveau client avant la navigation.
 */
export function getHoliswissAuthSpace(): HoliswissAuthSpace {
  if (typeof window === "undefined") return "dashboard";
  try {
    const path = window.location.pathname;

    // 1. Une route protégée impose toujours son client.
    if (path.startsWith("/admin")) return "admin";
    if (path.startsWith("/dashboard")) return "dashboard";

    // 2. Sur une route publique, respecter le changement explicite d'espace.
    const active = window.sessionStorage.getItem(ACTIVE_AUTH_SPACE_KEY);
    if (isHoliswissAuthSpace(active)) return active;

    // 3. Sans choix explicite, la connexion utilise son espace dédié.
    if (path.includes("/connexion")) return "login";

    // 4. Dernier espace connu (persistant entre les sessions)
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
    const current = window.sessionStorage.getItem(ACTIVE_AUTH_SPACE_KEY);
    if (current === space) return;

    window.sessionStorage.setItem(ACTIVE_AUTH_SPACE_KEY, space);
    if (space !== "login") {
      window.localStorage.setItem(LAST_AUTH_SPACE_KEY, space);
    }
    
    // Notification du changement d'espace pour les hooks réactifs
    window.dispatchEvent(new CustomEvent(AUTH_SPACE_CHANGE_EVENT, { detail: { space } }));
  } catch {
    // The auth client still works with its current in-memory session.
  }
}

export function clearHoliswissAuthSpace() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACTIVE_AUTH_SPACE_KEY);
    window.localStorage.removeItem(LAST_AUTH_SPACE_KEY);
    window.dispatchEvent(new CustomEvent(AUTH_SPACE_CHANGE_EVENT, { detail: { space: getHoliswissAuthSpace() } }));
  } catch {}
}

export function getHoliswissAuthStorageKey(space: HoliswissAuthSpace) {
  return `holiswiss-${space}-auth-token`;
}

export function clearStoredSupabaseSession(space: HoliswissAuthSpace) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getHoliswissAuthStorageKey(space));
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
