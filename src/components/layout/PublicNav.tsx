import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/holiswiss/Logo";
import { LanguageSwitcher } from "@/components/holiswiss/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGS, DEFAULT_LANG } from "@/lib/i18n";

export function PublicNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const first = pathname.split("/").filter(Boolean)[0];
  const lang = (SUPPORTED_LANGS as readonly string[]).includes(first) ? first : DEFAULT_LANG;

  const navLinks = [
    { to: "/$lang/therapeutes", label: t("nav.therapists") },
    { to: "/$lang/blog", label: t("nav.blog") },
    { to: "/$lang/evenements", label: t("nav.events") },
    { to: "/$lang/tarifs", label: t("nav.pricing") },
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[rgba(184,110,249,0.2)] bg-[#3d1a5c]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              params={{ lang }}
              className="text-sm font-medium text-[#d4c4e0] hover:text-white transition-colors"
              activeProps={{ className: "text-white" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link to="/$lang/connexion" params={{ lang }} className="hidden sm:inline">
            <Button variant="ghost" size="sm" className="text-[#d4c4e0] hover:bg-white/10 hover:text-white">{t("nav.login")}</Button>
          </Link>
          <Link to="/$lang/inscription" params={{ lang }}>
            <Button size="sm" className="bg-[#b86ef9] text-white hover:bg-[#a855f7]">{t("nav.signup")}</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}