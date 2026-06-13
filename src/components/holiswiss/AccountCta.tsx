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

/**
 * CTA conscient de l'auth : si l'utilisateur est connecté, renvoie vers
 * son espace (admin ou thérapeute). Sinon, lien vers la connexion.
 * Évite l'illusion de déconnexion quand on revient sur le site public.
 */
export function AccountCta({ lang, loggedOutLabel, className, style, onMouseEnter, onMouseLeave, onClick }: Props) {
  const { user, loading } = useAuth();
  const check = useServerFn(checkIsAdmin);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setIsAdmin(null); return; }
    let alive = true;
    check().then((r) => { if (alive) setIsAdmin(!!r.isAdmin); }).catch(() => alive && setIsAdmin(false));
    return () => { alive = false; };
  }, [user, check]);

  if (loading || !user) {
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

  const to = isAdmin ? "/admin" : "/dashboard";
  const label = isAdmin ? "Admin" : "Mon espace";
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