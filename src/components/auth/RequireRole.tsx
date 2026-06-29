import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LoadingScreen } from "@/components/holiswiss/LoadingScreen";
import { useRole } from "@/hooks/use-role";
import type { AppRole } from "@/lib/auth-utils";

type RequireRoleProps = {
  role: AppRole;
  children: ReactNode;
  redirectTo?: string;
};

export function RequireRole({ role, children, redirectTo = "/fr/connexion" }: RequireRoleProps) {
  const { role: currentRole, loading } = useRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (currentRole !== role) {
      navigate({ to: redirectTo as never, replace: true });
    }
  }, [currentRole, loading, navigate, redirectTo, role]);

  if (loading || currentRole !== role) return <LoadingScreen />;
  return <>{children}</>;
}
