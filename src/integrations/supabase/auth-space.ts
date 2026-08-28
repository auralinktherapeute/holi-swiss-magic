export type HoliswissAuthSpace = "login" | "admin" | "dashboard";

export const ACTIVE_AUTH_SPACE_KEY = "holiswiss-active-auth-space";
export const LAST_AUTH_SPACE_KEY = "holiswiss-last-auth-space";
export const AUTH_SPACE_CHANGE_EVENT = "holiswiss-auth-space-change";

export const HOLISWISS_AUTH_SPACES: HoliswissAuthSpace[] = ["login", "admin", "dashboard"];

/**
 * CLÉ DE SESSION UNIQUE.
 *
 * Historiquement, Holiswiss créait TROIS clients Supabase (login / admin /
 * dashboard), chacun avec sa propre clé de stockage. La session était recopiée
 * d'un client à l'autre après la connexion, ce qui faisait cohabiter deux
 * clients porteurs du même refresh token : leurs rafraîchissements concurrents
 * déclenchaient la détection de réutilisation de Supabase et révoquaient la
 * session (déconnexions aléatoires, écran « Impossible de vérifier vos droits »).
 *
 * Désormais : une seule clé, donc un seul client, donc un seul autoRefreshToken.
 * `getHoliswissAuthStorageKey` renvoie cette clé quel que soit l'espace, et
 * `getHoliswissAuthSpace` renvoie une valeur constante afin que le cache de
 * clients de `client.ts` ne contienne qu'une seule instance.
 */
export const UNIFIED_AUTH_STORAGE_KEY = "holiswiss-auth-token";

/** Espace unique utilisé pour instancier le client Supabase. */
const CLIENT_SPACE: HoliswissAuthSpace = "dashboard";

const validSpaces = new Set<HoliswissAuthSpace>(["login", "admin", "dashboard"]);

export function isHoliswissAuthSpace(value: unknown): value is HoliswissAuthSpace {
  return typeof value === "string" && validSpaces.has(value as HoliswissAuthSpace);
}

/** Ancienne clé de stockage d'un espace (conservée pour la migration). */
export function getLegacyAuthStorageKey(space: HoliswissAuthSpace) {
  return `holiswiss-${space}-auth-token`;
}

export const LEGACY_AUTH_STORAGE_KEYS = HOLISWISS_AUTH_SPACES.map(getLegacyAuthStorageKey);

/**
 * Espace « logique » (à quoi correspond la page courante). Purement informatif :
 * il ne pilote plus le stockage de session.
 */
export function getHoliswissLogicalSpace(): HoliswissAuthSpace {
  if (typeof window === "undefined") return "dashboard";
  try {
    const path = window.location.pathname;
    if (path.startsWith("/admin")) return "admin";
    if (path.startsWith("/dashboard")) return "dashboard";
    const active = window.sessionStorage.getItem(ACTIVE_AUTH_SPACE_KEY);
    if (isHoliswissAuthSpace(active)) return active;
    if (path.includes("/connexion")) return "login";
    const last = window.localStorage.getItem(LAST_AUTH_SPACE_KEY);
    if (isHoliswissAuthSpace(last)) return last;
  } catch {
    // Stockage indisponible (navigation privée, Safari) : valeur par défaut.
  }
  return "dashboard";
}

/**
 * Espace utilisé par `client.ts` comme clé de cache : constant, pour garantir
 * une instance de client Supabase unique par onglet.
 */
export function getHoliswissAuthSpace(): HoliswissAuthSpace {
  return CLIENT_SPACE;
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
    window.dispatchEvent(new CustomEvent(AUTH_SPACE_CHANGE_EVENT, { detail: { space: getHoliswissLogicalSpace() } }));
  } catch {}
}

/** Clé de stockage réellement utilisée par le client Supabase : toujours unique. */
export function getHoliswissAuthStorageKey(_space?: HoliswissAuthSpace) {
  return UNIFIED_AUTH_STORAGE_KEY;
}

/**
 * Migration transparente : si aucune session n'existe encore sous la clé
 * unique, on reprend la première session valide trouvée dans les anciennes
 * clés. Les anciennes clés ne sont PAS supprimées ici — elles ne sont plus
 * lues par aucun client, donc inertes, et servent de filet de sécurité. Elles
 * sont nettoyées à la déconnexion.
 */
export function migrateLegacySessionIfNeeded() {
  if (typeof window === "undefined") return;
  try {
    const store = window.localStorage;
    if (store.getItem(UNIFIED_AUTH_STORAGE_KEY)) return;

    for (const key of LEGACY_AUTH_STORAGE_KEYS) {
      const raw = store.getItem(key);
      if (!raw) continue;
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      // Une session est reprise uniquement si elle porte un refresh token :
      // même expiré, l'access token sera renouvelé automatiquement.
      if (parsed && typeof parsed === "object" && typeof parsed.refresh_token === "string" && parsed.refresh_token) {
        store.setItem(UNIFIED_AUTH_STORAGE_KEY, raw);
        return;
      }
    }
  } catch {
    // Aucune migration possible : l'utilisateur se reconnectera normalement.
  }
}

// Doit s'exécuter AVANT la création du client Supabase (ce module est importé
// par client.ts, dont le client n'est instancié qu'au premier accès).
migrateLegacySessionIfNeeded();

/** Supprime l'ANCIENNE clé d'un espace. Ne touche jamais la session unifiée. */
export function clearStoredSupabaseSession(space: HoliswissAuthSpace) {
  if (typeof window === "undefined") return;
  try {
    const key = getLegacyAuthStorageKey(space);
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  } catch {}
}

/** Nettoyage complet (déconnexion) : anciennes clés + session unifiée. */
export function clearStoredSupabaseSessions(spaces: HoliswissAuthSpace[] = HOLISWISS_AUTH_SPACES) {
  if (typeof window === "undefined") return;
  for (const space of spaces) {
    clearStoredSupabaseSession(space);
  }
  try {
    window.localStorage.removeItem(UNIFIED_AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(UNIFIED_AUTH_STORAGE_KEY);
  } catch {}
}

export function clearLegacySupabaseSessions() {
  if (typeof window === "undefined") return;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      // La session unifiée est intouchable ici : ce nettoyage ne vise que les
      // jetons parasites laissés par d'anciennes versions ou d'autres SDK.
      if (key === UNIFIED_AUTH_STORAGE_KEY) continue;
      if (key.startsWith("sb-") || key.includes("-auth-token")) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {}
}

/** Vrai si un jeton de session est présent (clé unifiée ou ancienne clé). */
export function hasStoredSupabaseSession() {
  if (typeof window === "undefined") return false;
  try {
    if (window.localStorage.getItem(UNIFIED_AUTH_STORAGE_KEY)) return true;
    return LEGACY_AUTH_STORAGE_KEYS.some((key) => Boolean(window.localStorage.getItem(key)));
  } catch {
    return false;
  }
}
