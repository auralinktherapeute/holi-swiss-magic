import { Link, useRouterState, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  User,
  Calendar,
  FileText,
  Menu,
  ArrowLeft,
  Home,
  Settings,
  LogOut,
  Star,
  BookmarkCheck,
  CalendarDays,
  CreditCard,
  Gift,
  Crown,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { Logo } from "@/components/holiswiss/Logo";
import { signOutCompletely } from "@/lib/auth-utils";

function usePageTitle(): string {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const map: Array<[string, string]> = [
    ["/dashboard/profil", t("dashboard.profile")],
    ["/dashboard/agenda", t("dashboard.agenda")],
    ["/dashboard/reservations", t("dashboard.reservations")],
    ["/dashboard/articles", t("dashboard.articles")],
    ["/dashboard/avis", t("dashboard.reviews")],
    ["/dashboard/evenements", t("dashboard.events")],
    ["/dashboard/crm", "CRM Elite"],
    ["/dashboard/abonnement", t("dashboard.subscription")],
    ["/dashboard/parrainage", t("dashboard.referral")],
  ];
  for (const [path, label] of map) {
    if (pathname.startsWith(path)) return label;
  }
  return t("dashboard.overview");
}

export function MobileDashboardHeader() {
  const router = useRouter();
  const title = usePageTitle();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isRoot = pathname === "/dashboard" || pathname === "/dashboard/";

  return (
    <header className="md:hidden sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border bg-surface/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex w-10 items-center justify-start">
        {!isRoot ? (
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) router.history.back();
              else router.navigate({ to: "/dashboard" });
            }}
            aria-label="Retour"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 hover:text-foreground active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <Link
            to="/dashboard"
            aria-label="Tableau de bord"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 hover:text-foreground"
          >
            <LayoutDashboard className="h-5 w-5" />
          </Link>
        )}
      </div>
      <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground">
        {title}
      </h1>
      <div className="flex w-10 items-center justify-end">
        <Link
          to="/$lang"
          params={{ lang: "fr" }}
          aria-label="Accueil Holiswiss"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 hover:text-foreground"
        >
          <Home className="h-5 w-5" />
        </Link>
      </div>
    </header>
  );
}

export function MobileDashboardBottomNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [menuOpen, setMenuOpen] = useState(false);
  const queryClient = useQueryClient();

  const tabs: Array<{ to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean }> = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard.overview"), exact: true },
    { to: "/dashboard/profil", icon: User, label: t("dashboard.profile") },
    { to: "/dashboard/agenda", icon: Calendar, label: t("dashboard.agenda") },
    { to: "/dashboard/articles", icon: FileText, label: "Publier" },
  ];

  const moreItems: Array<{ to: string; icon: typeof LayoutDashboard; label: string }> = [
    { to: "/dashboard/reservations", icon: BookmarkCheck, label: t("dashboard.reservations") },
    { to: "/dashboard/avis", icon: Star, label: t("dashboard.reviews") },
    { to: "/dashboard/evenements", icon: CalendarDays, label: t("dashboard.events") },
    { to: "/dashboard/crm", icon: Crown, label: "CRM Elite" },
    { to: "/dashboard/abonnement", icon: CreditCard, label: t("dashboard.subscription") },
    { to: "/dashboard/parrainage", icon: Gift, label: t("dashboard.referral") },
  ];

  const onLogout = async () => {
    await signOutCompletely(queryClient);
    window.location.replace("/fr/connexion");
  };

  return (
    <>
      <nav
        aria-label="Navigation principale"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 pb-[env(safe-area-inset-bottom)]"
        style={{ touchAction: "manipulation" }}
      >
        <ul className="grid grid-cols-5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to as any}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-14 min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors ${
                    active ? "text-primary" : "text-foreground/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span className="truncate max-w-full leading-none">{tab.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Menu"
                  className="flex h-14 w-full min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium text-foreground/60 hover:text-foreground"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                  <span className="leading-none">Menu</span>
                </button>
              </SheetTrigger>
              <SheetContent
                side="bottom"
                className="rounded-t-2xl border-border bg-surface p-0 pb-[env(safe-area-inset-bottom)]"
              >
                <SheetHeader className="flex flex-row items-center justify-between px-5 pt-5">
                  <SheetTitle className="text-base">Menu</SheetTitle>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    aria-label="Fermer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-foreground/70 hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </SheetHeader>
                <div className="px-3 py-4">
                  <Link
                    to="/$lang"
                    params={{ lang: "fr" }}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-muted"
                  >
                    <Home className="h-4 w-4" />
                    Accueil holiswiss.ch
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-muted"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {t("dashboard.overview")}
                  </Link>
                  <Link
                    to="/dashboard/profil"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-muted"
                  >
                    <User className="h-4 w-4" />
                    {t("dashboard.profile")}
                  </Link>
                  <div className="my-2 h-px bg-border" />
                  {moreItems.map((it) => {
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.to}
                        to={it.to as any}
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-muted"
                      >
                        <Icon className="h-4 w-4" />
                        {it.label}
                      </Link>
                    );
                  })}
                  <div className="my-2 h-px bg-border" />
                  <Link
                    to="/dashboard/abonnement"
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-foreground/80 hover:bg-muted"
                  >
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </Link>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-500 hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {t("dashboard.logout")}
                  </button>
                  <div className="mt-4 flex items-center justify-center opacity-60">
                    <Logo />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </>
  );
}