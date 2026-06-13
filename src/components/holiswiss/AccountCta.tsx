import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { checkIsAdmin } from "@/lib/admin.functions";

type Props = {
  lang: string;
  loggedOutLabel: string;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: React.MouseEventHandler<HTMLAnchorElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLAnchorElement>;
  onClick?: () => void;
};

const LAST_AUTH_SPACE_KEY = "holiswiss-last-auth-space";

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
  const { user, loading } = useAuth();
  const check = useServerFn(checkIsAdmin);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [lastAuthSpace, setLastAuthSpace] = useState<"admin" | "dashboard">(() =>
    readLastAuthSpace(),
  );

  useEffect(() => {
    if (!user) {
      setIsAdmin(null);
      return;
    }
    let alive = true;
    check()
      .then((r) => {
        if (!alive) return;
        const nextSpace = r.isAdmin ? "admin" : "dashboard";
        setIsAdmin(!!r.isAdmin);
        setLastAuthSpace(nextSpace);
        try {
          window.localStorage.setItem(LAST_AUTH_SPACE_KEY, nextSpace);
        } catch {
          // Le CTA reste fonctionnel même si le stockage local est indisponible.
        }
      })
      .catch(() => alive && setIsAdmin(null));
    return () => {
      alive = false;
    };
  }, [user, check]);

  if (loading) {
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

  const activeSpace = isAdmin === true ? "admin" : isAdmin === false ? "dashboard" : lastAuthSpace;
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