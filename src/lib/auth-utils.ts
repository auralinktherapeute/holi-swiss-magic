import type { QueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  forgetAllAuthSpaceSessions,
  forgetAuthSpaceSession,
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
  const space = setAuthSpaceForRole(role);
  clearStoredSupabaseSessions(["login"]);
  clearLegacySupabaseSessions();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
  // Le client « login » doit oublier la session en mémoire, sinon son
  // auto-refresh entre en concurrence avec celui de l'espace cible et fait
  // révoquer le refresh token (déconnexions aléatoires).
  await forgetAuthSpaceSession("login");
  clearStoredSupabaseSession("login");
  return space;
}

export function clearHoliswissSessionState() {
  clearAllSessionState();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_AUTH_SPACE_KEY);
    window.localStorage.removeItem(LAST_ACTIVITY_KEY);
    window.sessionStorage.removeItem(LAST_AUTH_SPACE_KEY);
    window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    // Best effort only: auth sign-out remains the source of truth.
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
    setHoliswissAuthSpace(currentSpace);
    // scope "local" : ne déconnecte que ce navigateur. La valeur par défaut
    // ("global") révoquait toutes les sessions du compte, y compris sur les
    // autres appareils du thérapeute.
    await supabase.auth.signOut({ scope: "local" });
  } finally {
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
  const { data, error } = await (supabase as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ role: string | null }>;
  return resolvePrimaryRole(rows.map((row) => row.role));
}

export async function requireCurrentRole(role: AppRole): Promise<AppRole | null> {
  const currentRole = await getCurrentUserRole();
  return currentRole === role ? currentRole : null;
}
