import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  forgetAllAuthSpaceSessions,
  supabase,
} from "@/integrations/supabase/client";
import {
  clearHoliswissAuthSpace,
  clearLegacySupabaseSessions,
  clearStoredSupabaseSession,
  clearStoredSupabaseSessions,
  getHoliswissAuthSpace,
  LAST_AUTH_SPACE_KEY,
  setHoliswissAuthSpace,
  type HoliswissAuthSpace,
} from "@/integrations/supabase/auth-space";
import { clearAllSessionState } from "@/hooks/use-session-state";

export { LAST_AUTH_SPACE_KEY } from "@/integrations/supabase/auth-space";

export type AppRole = "admin" | "therapist" | "moderator" | "user";

const LAST_ACTIVITY_KEY = "holiswiss-last-activity";
const OAUTH_FLOW_KEY = "holiswiss-oauth-flow";
const OAUTH_FLOW_MAX_AGE_MS = 10 * 60 * 1000;

export type OAuthFlow = "login" | "signup";

const rolePriority: AppRole[] = ["admin", "therapist", "moderator", "user"];

export function resolvePrimaryRole(roles: Array<string | null | undefined>): AppRole {
  const set = new Set(roles.filter(Boolean));
  return rolePriority.find((role) => set.has(role)) ?? "user";
}

export function roleToSpace(role: AppRole): "admin" | "dashboard" {
  return role === "admin" ? "admin" : "dashboard";
}

export function setAuthSpaceForRole(role: AppRole) {
  const space = roleToSpace(role);
  setHoliswissAuthSpace(space);
  return space;
}

export async function persistSessionInRoleSpace(session: { access_token: string; refresh_token: string }, role: AppRole) {
  // Arrêter le client source avant le changement d'espace. Appeler signOut
  // après la copie peut invalider le refresh token partagé avec le nouveau
  // client, ce qui provoquait les déconnexions aléatoires (notamment Safari).
  supabase.auth.stopAutoRefresh();
  const space = setAuthSpaceForRole(role);
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;

  // Supprimer uniquement le stockage source : aucun appel réseau, donc aucune
  // révocation possible de la session qui vient d'être attachée.
  clearStoredSupabaseSession("login");
  clearLegacySupabaseSessions();
  return space;
}

export function clearHoliswissSessionState() {
  clearAllSessionState();
  clearHoliswissAuthSpace();
  if (typeof window === "undefined") return;
  try {
    // Nettoyage complet des métadonnées de session
    const keys = [LAST_AUTH_SPACE_KEY, LAST_ACTIVITY_KEY, OAUTH_FLOW_KEY];
    keys.forEach(key => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
  } catch {
    // Best effort only
  }
}

export function beginOAuthFlow(flow: OAuthFlow) {
  prepareLoginAuthSpace();
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      OAUTH_FLOW_KEY,
      JSON.stringify({ flow, startedAt: Date.now() }),
    );
  } catch {
    // The OAuth redirect still works when sessionStorage is unavailable.
  }
}

export function getPendingOAuthFlow(expectedFlow: OAuthFlow) {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(OAUTH_FLOW_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { flow?: unknown; startedAt?: unknown };
    const isFresh =
      typeof parsed.startedAt === "number" &&
      Date.now() - parsed.startedAt <= OAUTH_FLOW_MAX_AGE_MS;
    if (parsed.flow === expectedFlow && isFresh) return true;
    window.sessionStorage.removeItem(OAUTH_FLOW_KEY);
  } catch {
    try {
      window.sessionStorage.removeItem(OAUTH_FLOW_KEY);
    } catch {
      // Best effort only.
    }
  }
  return false;
}

export function completeOAuthFlow() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(OAUTH_FLOW_KEY);
  } catch {
    // Best effort only.
  }
}

export async function signOutCompletely(queryClient?: QueryClient) {
  const currentSpace = getHoliswissAuthSpace();
  try {
    await queryClient?.cancelQueries();
    queryClient?.clear();
  } catch {
    // Cache cleanup must never block sign-out.
  }

  try {
    // On s'assure d'être dans l'espace actuel pour le signOut
    setHoliswissAuthSpace(currentSpace);

    // scope "local" : ne déconnecte que ce navigateur.
    // Important pour ne pas invalider les sessions sur les autres appareils.
    await supabase.auth.signOut({ scope: "local" });
  } finally {
    // Nettoyage radical de tous les états locaux
    await forgetAllAuthSpaceSessions(currentSpace);
    clearStoredSupabaseSessions();
    clearLegacySupabaseSessions();
    clearHoliswissSessionState();
    clearHoliswissAuthSpace();
  }
}

export function prepareLoginAuthSpace() {
  setHoliswissAuthSpace("login");
  clearStoredSupabaseSession("login");
  clearLegacySupabaseSessions();
}

export function switchAuthSpace(space: HoliswissAuthSpace) {
  setHoliswissAuthSpace(space);
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getCurrentUserRole(): Promise<AppRole | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  // Utilisation de n'importe quel client via proxy
  const { data, error } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (error) return null;
  const rows = (data ?? []) as Array<{ role: string | null }>;

  // ZÉRO LIGNE ≠ « simple visiteur ».
  // Une requête partie sans jeton (client d'un autre espace, session pas encore hydratée)
  // est filtrée par la RLS et renvoie 0 ligne SANS erreur.
  if (rows.length === 0) return null;

  return resolvePrimaryRole(rows.map((row) => row.role));
}

/**
 * Rôle faisant autorité : lecture client, puis repli serveur (service role)
 * quand la RLS/le jeton rendent la lecture client muette (ex: Safari 3rd party restrictions).
 */
export async function resolveAuthoritativeRole(): Promise<AppRole | null> {
  const clientRole = await getCurrentUserRole();
  if (clientRole) return clientRole;

  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;

  try {
    const { getMyRole } = await import("@/lib/auth-role.functions");
    const result = await getMyRole();
    return (result.role as AppRole | null) ?? null;
  } catch {
    return null;
  }
}

export async function requireCurrentRole(role: AppRole): Promise<AppRole | null> {
  const currentRole = await resolveAuthoritativeRole();
  return currentRole === role ? currentRole : null;
}
