import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Logo } from "@/components/holiswiss/Logo";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyPendingReservationCount } from "@/lib/dashboard.functions";
import { AccountManageDialog } from "@/components/dashboard/AccountManageDialog";
import {
  LayoutDashboard,
  User,
  Calendar,
  BookmarkCheck,
  FileText,
  Star,
  CalendarDays,
  CreditCard,
  Gift,
  Package,
  ClipboardList,
  Receipt,
  HelpCircle,
  Gauge,
  Users,
  LogOut,
} from "lucide-react";
import { useServerFn as useServerFnHelp } from "@tanstack/react-start";
import { resetOnboarding } from "@/lib/onboarding.functions";
import { useQueryClient } from "@tanstack/react-query";
import { signOutCompletely } from "@/lib/auth-utils";
import { toast } from "sonner";

export function TherapistNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const fetchPendingCount = useServerFn(getMyPendingReservationCount);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const { count } = await fetchPendingCount();
      setPendingCount(count ?? 0);
    };
    refresh();
    const id = window.setInterval(refresh, 30000);
    return () => window.clearInterval(id);
  }, [fetchPendingCount, user]);

  // Deux groupes : la gestion du cabinet d'abord, la vitrine publique ensuite.
  const items = [
    {
      to: "/dashboard",
      icon: LayoutDashboard,
      label: t("dashboard.overview"),
      exact: true,
      tourId: "nav-overview",
      section: "Cabinet",
    },
    { to: "/dashboard/agenda", icon: Calendar, label: t("dashboard.agenda"), tourId: "nav-agenda" },
    {
      to: "/dashboard/reservations",
      icon: BookmarkCheck,
      label: t("dashboard.reservations"),
      badge: pendingCount,
      tourId: "nav-reservations",
    },
    { to: "/dashboard/clients", icon: Users, label: "Clients", tourId: "nav-clients" },
    {
      to: "/dashboard/facturation",
      icon: Receipt,
      label: "Facturation",
      tourId: "nav-facturation",
    },
    
    { to: "/dashboard/forfaits", icon: Package, label: "Forfaits", tourId: "nav-forfaits" },
    {
      to: "/dashboard/questionnaires",
      icon: ClipboardList,
      label: "Questionnaires",
      tourId: "nav-questionnaires",
    },
    { to: "/dashboard/profil", icon: User, label: t("dashboard.profile"), tourId: "nav-profil", section: "Vitrine" },
    { to: "/dashboard/visibilite", icon: Gauge, label: "Score de visibilité", tourId: "nav-visibilite" },
    { to: "/dashboard/articles", icon: FileText, label: t("dashboard.articles") },
    { to: "/dashboard/avis", icon: Star, label: t("dashboard.reviews") },
    { to: "/dashboard/evenements", icon: CalendarDays, label: t("dashboard.events") },
    { to: "/dashboard/salons", icon: Users, label: "Salons", tourId: "nav-salons" },
    { to: "/dashboard/abonnement", icon: CreditCard, label: t("dashboard.subscription"), section: "Compte" },
    { to: "/dashboard/parrainage", icon: Gift, label: t("dashboard.referral") },
  ];

  const reset = useServerFnHelp(resetOnboarding);
  const restartTour = async () => {
    try {
      await reset();
      await qc.invalidateQueries({ queryKey: ["onboarding-state"] });
      window.dispatchEvent(new CustomEvent("holiswiss:start-tour"));
    } catch {
      // Le redémarrage du tutoriel est une action best-effort.
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOutCompletely(qc);
      navigate({ to: "/$lang/connexion", params: { lang: "fr" }, replace: true });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : t("dashboard.logout_error", "La déconnexion a échoué. Veuillez réessayer.");
      toast.error(message);
      setIsLoggingOut(false);
    }
  };

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="h-16 flex items-center justify-between px-6 border-b border-border">
        <Logo />
        <button
          type="button"
          onClick={restartTour}
          aria-label="Revoir le tutoriel"
          title="Revoir le tutoriel"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary-xlight transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
      <div className="px-6 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Connecté en tant que Thérapeute
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          const section = (it as { section?: string }).section;
          return (
            <div key={`${it.to}-wrap`}>
            {section && (
              <div className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {section}
              </div>
            )}
            <Link

              key={it.to}
              to={it.to}
              data-tour-id={(it as { tourId?: string }).tourId}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary-xlight text-primary"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
              {"badge" in it && it.badge && it.badge > 0 ? (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                  {it.badge}
                </span>
              ) : null}
            </Link>
            </div>
          );
        })}

      </nav>
      <div className="border-t border-border p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary-xlight text-primary flex items-center justify-center text-sm font-semibold">
            T
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{t("dashboard.therapist_label")}</div>
            <div className="text-xs text-muted-foreground truncate">
              {t("dashboard.demo_account")}
            </div>
            <div className="mt-1">
              <AccountManageDialog />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          aria-label={t("dashboard.logout")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoggingOut ? (
            <span
              className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          {t("dashboard.logout")}
        </button>
      </div>
    </aside>
  );
}
