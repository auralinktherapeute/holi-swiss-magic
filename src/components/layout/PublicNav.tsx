import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/holiswiss/Logo";
import { LanguageSwitcher } from "@/components/holiswiss/LanguageSwitcher";
import { Button } from "@/components/ui/button";

export function PublicNav() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || "fr").split("-")[0];

  const navLinks = [
    { to: "/$lang/therapeutes", label: t("nav.therapists") },
    { to: "/$lang/blog", label: t("nav.blog") },
    { to: "/$lang/evenements", label: t("nav.events") },
    { to: "/$lang/tarifs", label: t("nav.pricing") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              params={{ lang }}
              className="text-sm font-medium text-foreground/80 hover:text-primary transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/$lang/connexion" params={{ lang }} className="hidden sm:inline">
            <Button variant="ghost" size="sm">{t("nav.login")}</Button>
          </Link>
          <Link to="/$lang/inscription" params={{ lang }}>
            <Button size="sm">{t("nav.signup")}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}