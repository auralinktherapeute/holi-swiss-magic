import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LoadingScreen } from "@/components/holiswiss/LoadingScreen";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";
import { signOutCompletely, type AppRole } from "@/lib/auth-utils";

type RequireRoleProps = {
  role: AppRole;
  children: ReactNode;
  redirectTo?: string;
};

const MAX_AUTO_RETRIES = 2;

export function RequireRole({ role, children, redirectTo = "/fr/connexion" }: RequireRoleProps) {
  const { role: currentRole, loading, refresh } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [autoRetries, setAutoRetries] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const retryTimer = useRef<number | null>(null);

  // null signifie « rôle non résolu » (réseau/RLS/jeton), pas « accès refusé ».
  // Seul un rôle effectivement résolu et différent déclenche une redirection.
  useEffect(() => {
    if (loading) return;
    if (currentRole !== null && currentRole !== role) {
      navigate({ to: redirectTo as never, replace: true });
    }
  }, [currentRole, loading, navigate, redirectTo, role]);

  // Deux tentatives automatiques espacées : une coupure réseau passagère ne
  // doit jamais coûter la session à l'utilisateur.
  useEffect(() => {
    if (loading || currentRole !== null || autoRetries >= MAX_AUTO_RETRIES) return;
    retryTimer.current = window.setTimeout(() => {
      setAutoRetries((n) => n + 1);
      void refresh();
    }, 1200 * (autoRetries + 1));
    return () => {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
    };
  }, [loading, currentRole, autoRetries, refresh]);

  const onRetry = async () => {
    setRetrying(true);
    try {
      await refresh();
    } finally {
      setRetrying(false);
    }
  };

  const onSignOut = async () => {
    setSigningOut(true);
    try {
      await signOutCompletely(queryClient);
    } finally {
      navigate({ to: `${redirectTo}?deconnecte=1` as never, replace: true });
    }
  };

  if (loading) return <LoadingScreen />;

  if (currentRole === null) {
    // Tant que les tentatives automatiques tournent, on n'affiche pas d'erreur.
    if (autoRetries < MAX_AUTO_RETRIES) return <LoadingScreen />;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-base font-medium text-foreground">
            Impossible de vérifier vos droits pour le moment.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre session est peut-être momentanément indisponible. Réessayez, ou
            reconnectez-vous si le problème persiste.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={onRetry} disabled={retrying || signingOut} className="min-h-11">
              {retrying ? "Vérification…" : "Réessayer"}
            </Button>
            <Button
              variant="outline"
              onClick={onSignOut}
              disabled={retrying || signingOut}
              className="min-h-11"
            >
              {signingOut ? "Déconnexion…" : "Se déconnecter"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (currentRole !== role) return <LoadingScreen />;
  return <>{children}</>;
}
