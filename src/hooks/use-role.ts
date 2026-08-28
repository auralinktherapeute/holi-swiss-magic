import { useCallback, useEffect, useState } from "react";
import { resolveAuthoritativeRole, type AppRole } from "@/lib/auth-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Vérification complète des droits : on réhydrate d'abord la session (et on
 * force un rafraîchissement du jeton s'il est expiré) AVANT de relire le rôle.
 * Sans cela, un « Réessayer » relançait la même lecture avec le même jeton mort
 * et renvoyait éternellement le même écran d'erreur.
 */
async function verifyRole(): Promise<AppRole | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) return null;
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt && expiresAt - Date.now() < 30_000) {
      await supabase.auth.refreshSession();
    }
  } catch {
    // On tente quand même la résolution du rôle (repli serveur inclus).
  }
  return resolveAuthoritativeRole();
}

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextRole = await verifyRole();
      setRole(nextRole);
      return nextRole;
    } catch {
      setRole(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    setLoading(true);
    verifyRole()
      .then((nextRole) => {
        if (!alive) return;
        setRole(nextRole);
      })
      .catch(() => {
        if (!alive) return;
        setRole(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [authLoading, user?.id]);

  return { role, loading: authLoading || loading, refresh };
}
