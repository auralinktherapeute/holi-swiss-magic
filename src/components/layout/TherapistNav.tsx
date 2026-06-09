import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/holiswiss/Logo";
import {
  LayoutDashboard, User, Calendar, BookmarkCheck, FileText,
  Star, CalendarDays, CreditCard, Gift, Settings,
} from "lucide-react";

export function TherapistNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard.overview"), exact: true },
    { to: "/dashboard/profil", icon: User, label: t("dashboard.profile") },
    { to: "/dashboard/agenda", icon: Calendar, label: t("dashboard.agenda") },
    { to: "/dashboard/reservations", icon: BookmarkCheck, label: t("dashboard.reservations") },
    { to: "/dashboard/articles", icon: FileText, label: t("dashboard.articles") },
    { to: "/dashboard/avis", icon: Star, label: t("dashboard.reviews") },
    { to: "/dashboard/evenements", icon: CalendarDays, label: t("dashboard.events") },
    { to: "/dashboard/abonnement", icon: CreditCard, label: t("dashboard.subscription") },
    { to: "/dashboard/parrainage", icon: Gift, label: t("dashboard.referral") },
  ];
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="h-16 flex items-center px-6 border-b border-border"><Logo /></div>
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary-xlight text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary-xlight text-primary flex items-center justify-center text-sm font-semibold">T</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">Thérapeute</div>
          <div className="text-xs text-muted-foreground truncate">Compte démo</div>
        </div>
        <Settings className="h-4 w-4 text-muted-foreground" />
      </div>
    </aside>
  );
}