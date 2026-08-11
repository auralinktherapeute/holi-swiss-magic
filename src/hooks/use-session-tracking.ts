import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { startSession, endSession } from "@/lib/analytics.functions";

const STORAGE_KEY = "holiswiss-analytics-session-id";

export type DeviceType = "mobile" | "tablet" | "desktop" | "other";

export function detectDeviceType(): DeviceType {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "mobile";
  if (/Macintosh|Windows|Linux/i.test(ua)) return "desktop";
  return "other";
}

/**
 * Ouvre une session analytics quand un utilisateur se connecte, la clôt à
 * la déconnexion. Monté une seule fois, globalement (voir __root.tsx).
 *
 * Limite connue et assumée : sans le sweep serveur optionnel
 * `close_stale_sessions` (voir la migration), un onglet fermé sans passer
 * par le beacon `pagehide` ne recevra jamais de `ended_at` explicite. Les
 * rapports d'admin compensent en utilisant `last_seen_at` (rafraîchi à
 * chaque page vue) plutôt que de dépendre uniquement de `ended_at`.
 */
export function useSessionTracking() {
  const { user } = useAuth();
  const doStart = useServerFn(startSession);
  const doEnd = useServerFn(endSession);
  const sessionIdRef = useRef<string | null>(null);
  const trackedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (userId && userId !== trackedUserIdRef.current) {
      trackedUserIdRef.current = userId;
      doStart({ data: { deviceType: detectDeviceType(), userAgent: navigator.userAgent } })
        .then((res) => {
          sessionIdRef.current = res.sessionId;
          try {
            sessionStorage.setItem(STORAGE_KEY, res.sessionId);
          } catch {
            // Stockage indisponible (navigation privée) : le tracking continue
            // en mémoire pour l'onglet courant, sans persister au rechargement.
          }
        })
        .catch((e) => console.error("[analytics] startSession failed:", e));
    } else if (!userId && trackedUserIdRef.current) {
      const sessionId = sessionIdRef.current;
      trackedUserIdRef.current = null;
      sessionIdRef.current = null;
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // best-effort
      }
      if (sessionId) {
        doEnd({ data: { sessionId } }).catch((e) => console.error("[analytics] endSession failed:", e));
      }
    }
  }, [user?.id]);

  // Best-effort : signale la fermeture d'onglet/navigation. Ce n'est pas
  // fiable à 100 % (voir la limite documentée ci-dessus) mais couvre la
  // majorité des départs volontaires.
  useEffect(() => {
    const onHide = () => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || typeof navigator.sendBeacon !== "function") return;
      const blob = new Blob([JSON.stringify({ sessionId })], { type: "application/json" });
      navigator.sendBeacon("/api/public/analytics/end-session", blob);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  return sessionIdRef;
}

/** Lit l'id de session analytics courant, s'il existe (pour les hooks de tracking). */
export function getCurrentAnalyticsSessionId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
