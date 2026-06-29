import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { LAST_AUTH_SPACE_KEY } from "@/lib/auth-utils";

type Props = {
  lang: string;
  loggedOutLabel: string;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
  onClick?: () => void;
};

function readLastAuthSpace(): "admin" | "dashboard" {
  if (typeof window === "undefined") return "dashboard";
  return window.localStorage.getItem(LAST_AUTH_SPACE_KEY) === "admin" ? "admin" : "dashboard";
}

/**
 * CTA conscient de l'auth : si l'utilisateur est connecté, renvoie vers
 * son espace (admin ou thérapeute). Sinon, lien vers la connexion.
 * Évite l'illusion de déconnexion quand on revient sur le site public.
 */
export function AccountCta({
  lang,
  loggedOutLabel,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: Props) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading } = useRole();
  // Valeur initiale SSR-safe ; localStorage lu après montage côté client
  const [lastAuthSpace, setLastAuthSpace] = useState<"admin" | "dashboard">("dashboard");

  useEffect(() => {
    setLastAuthSpace(readLastAuthSpace());
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!role) return;
    const nextSpace = role === "admin" ? "admin" : "dashboard";
    setLastAuthSpace(nextSpace);
    try {
      window.localStorage.setItem(LAST_AUTH_SPACE_KEY, nextSpace);
    } catch {
      // Le CTA reste fonctionnel même si le stockage local est indisponible.
    }
  }, [user, role]);

  if (authLoading || (user && roleLoading)) {
    const to = lastAuthSpace === "admin" ? "/admin" : "/dashboard";
    const label = lastAuthSpace === "admin" ? "Admin" : "Mon espace";
    return (
      <Link
        to={to}
        className={className}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {label}
      </Link>
    );
  }

  if (!user) {
    return (
      <Link
        to="/$lang/connexion"
        params={{ lang }}
        className={className}
        style={style}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      >
        {loggedOutLabel}
      </Link>
    );
  }

  const activeSpace = role === "admin" ? "admin" : role ? "dashboard" : lastAuthSpace;
  const to = activeSpace === "admin" ? "/admin" : "/dashboard";
  const label = activeSpace === "admin" ? "Admin" : "Mon espace";
  return (
    <Link
      to={to}
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {label}
    </Link>
  );
}
