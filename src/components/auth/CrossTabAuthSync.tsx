import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeToLogoutBroadcast } from "@/lib/auth-broadcast";
import { signOutCompletely } from "@/lib/auth-utils";

/**
 * Aligne tous les onglets Holiswiss du même navigateur sur la déconnexion.
 * Aucun autre appareil n'est affecté (la déconnexion Supabase reste locale).
 */
export function CrossTabAuthSync() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    return subscribeToLogoutBroadcast(() => {
      // `broadcast: false` : cet onglet ne rediffuse pas l'événement.
      void signOutCompletely(queryClient, { broadcast: false }).finally(() => {
        const isProtected = pathname.startsWith("/admin") || pathname.startsWith("/dashboard");
        if (isProtected) {
          navigate({ to: "/fr/connexion?deconnecte=1" as never, replace: true });
        }
      });
    });
  }, [navigate, queryClient, pathname]);

  return null;
}
