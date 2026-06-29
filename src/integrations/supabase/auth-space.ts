export type HoliswissAuthSpace = "login" | "admin" | "dashboard";

export const ACTIVE_AUTH_SPACE_KEY = "holiswiss-active-auth-space";
export const LAST_AUTH_SPACE_KEY = "holiswiss-last-auth-space";

export const HOLISWISS_AUTH_SPACES: HoliswissAuthSpace[] = ["login", "admin", "dashboard"];

const validSpaces = new Set<HoliswissAuthSpace>(["login", "admin", "dashboard"]);

export function isHoliswissAuthSpace(value: unknown): value is HoliswissAuthSpace {
  return typeof value === "string" && validSpaces.has(value as HoliswissAuthSpace);
}

export function getHoliswissAuthSpace(): HoliswissAuthSpace {
  if (typeof window === "undefined") return "dashboard";
  try {
    const path = window.location.pathname;
    if (path.startsWith("/admin")) return "admin";
    if (path.startsWith("/dashboard")) return "dashboard";

    const active = window.sessionStorage.getItem(ACTIVE_AUTH_SPACE_KEY);
    if (isHoliswissAuthSpace(active)) return active;

    if (path.includes("/connexion")) return "login";

    const last = window.localStorage.getItem(LAST_AUTH_SPACE_KEY);
    if (last === "admin") return "admin";
  } catch {
    // Ignore unavailable storage (private mode, SSR-like environments, etc.).
  }
  return "dashboard";
}

export function setHoliswissAuthSpace(space: HoliswissAuthSpace) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACTIVE_AUTH_SPACE_KEY, space);
    if (space !== "login") window.localStorage.setItem(LAST_AUTH_SPACE_KEY, space);
  } catch {
    // The auth client still works with its current in-memory session.
  }
}

export function clearHoliswissAuthSpace() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(ACTIVE_AUTH_SPACE_KEY);
  } catch {}
}

export function getHoliswissAuthStorageKey(space: HoliswissAuthSpace) {
  return `holiswiss-${space}-auth-token`;
}

export function clearStoredSupabaseSession(space: HoliswissAuthSpace) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getHoliswissAuthStorageKey(space));
  } catch {}
}

export function clearStoredSupabaseSessions(spaces: HoliswissAuthSpace[] = HOLISWISS_AUTH_SPACES) {
  if (typeof window === "undefined") return;
  for (const space of spaces) clearStoredSupabaseSession(space);
}

export function clearLegacySupabaseSessions() {
  if (typeof window === "undefined") return;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {}
}
