/**
 * Synchronisation de la déconnexion entre les onglets du MÊME navigateur.
 *
 * Supabase JS v2 n'écoute plus l'événement `storage` : un signOut dans un
 * onglet laissait les autres onglets avec une session morte en mémoire (401
 * silencieux, écrans bloqués). On diffuse donc un marqueur horodaté dans
 * localStorage, que chaque onglet observe.
 *
 * Portée strictement locale : aucun autre appareil, navigateur ou téléphone
 * n'est affecté.
 */
export const LOGOUT_BROADCAST_KEY = "holiswiss-logout-broadcast";

export function broadcastLogout() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
  } catch {
    // Best effort : la déconnexion de l'onglet courant reste effective.
  }
}

export function subscribeToLogoutBroadcast(onLogout: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (event: StorageEvent) => {
    if (event.key !== LOGOUT_BROADCAST_KEY || !event.newValue) return;
    onLogout();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
