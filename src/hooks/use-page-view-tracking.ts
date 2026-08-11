import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logPageView } from "@/lib/analytics.functions";
import { getCurrentAnalyticsSessionId } from "@/hooks/use-session-tracking";

const DEBOUNCE_MS = 400;

/**
 * Journalise une page vue à chaque changement de route. Monté une seule
 * fois, globalement (voir __root.tsx). Fonctionne pour les visiteurs
 * connectés et anonymes — l'identité éventuelle est résolue côté serveur
 * à partir du jeton d'auth, jamais envoyée depuis le client.
 *
 * Performance : fire-and-forget (n'attend jamais la réponse avant de
 * continuer la navigation) + un court debounce pour absorber les doubles
 * déclenchements (StrictMode en dev, redirections rapides en chaîne).
 */
export function usePageViewTracking() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const logView = useServerFn(logPageView);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Le debounce (via le cleanup ci-dessous, qui annule un minuteur en
    // attente) suffit à absorber le double-appel de StrictMode en dev :
    // le premier minuteur est annulé avant de se déclencher, seul le
    // second survit. Pas besoin d'une ref de déduplication en plus.
    timerRef.current = setTimeout(() => {
      logView({
        data: {
          path: pathname,
          referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
          sessionId: getCurrentAnalyticsSessionId() ?? undefined,
        },
      }).catch((e) => console.error("[analytics] logPageView failed:", e));
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname]);
}
