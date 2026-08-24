import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/holiswiss/LoadingScreen";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";
import type { AppRole } from "@/lib/auth-utils";

type RequireRoleProps = {
  role: AppRole;
  children: ReactNode;
  redirectTo?: string;
};

export function RequireRole({ role, children, redirectTo = "/fr/connexion" }: RequireRoleProps) {
  const { role: currentRole, loading, refresh } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    // null signifie « rôle non résolu » (réseau/RLS), pas « accès refusé ».
    // Seul un rôle effectivement résolu et différent déclenche une redirection.
    if (currentRole !== null && currentRole !== role) {
      navigate({ to: redirectTo as never, replace: true });
    }
  }, [currentRole, loading, navigate, redirectTo, role]);

  if (loading) return <LoadingScreen />;
  if (currentRole === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-muted-foreground">
            Impossible de vérifier vos droits pour le moment.
          </p>
          <Button className="mt-4" onClick={() => void refresh()}>
            Réessayer
          </Button>
        </div>
      </div>
    );
  }
  if (currentRole !== role) return <LoadingScreen />;
  return <>{children}</>;
}
