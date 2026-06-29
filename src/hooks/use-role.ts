import { useCallback, useEffect, useState } from "react";
import { getCurrentUserRole, type AppRole } from "@/lib/auth-utils";
import { useAuth } from "@/hooks/use-auth";

export function useRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRole(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const nextRole = await getCurrentUserRole();
      setRole(nextRole);
      return nextRole;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    setLoading(true);
    getCurrentUserRole()
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
