import { useCallback, useEffect, useState } from "react";
import { resolveAuthoritativeRole, type AppRole } from "@/lib/auth-utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Vérification complète des droits après hydratation de la session.
 * Le client gère déjà automatiquement la rotation du jeton : ne jamais lancer
 * ici un second refresh concurrent, qui pourrait révoquer la session.
 */
async function verifyRole(): Promise<AppRole | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
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

  return {
    role,
    loading: authLoading || loading,
    refresh,
    authLoading,
    isAuthenticated: user !== null,
  };
}
