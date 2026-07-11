import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Logo } from "@/components/holiswiss/Logo";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getMyPendingReservationCount } from "@/lib/dashboard.functions";
import { AccountManageDialog } from "@/components/dashboard/AccountManageDialog";
import {
  LayoutDashboard, User, Calendar, BookmarkCheck, FileText,
  Star, CalendarDays, CreditCard, Gift, Settings, Crown, Package, ClipboardList, Receipt,
} from "lucide-react";

export function TherapistNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const fetchPendingCount = useServerFn(getMyPendingReservationCount);
  const [pendingCount, setPendingCount] = useState(0);

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

  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dashboard.overview"), exact: true },
    { to: "/dashboard/profil", icon: User, label: t("dashboard.profile") },
    { to: "/dashboard/agenda", icon: Calendar, label: t("dashboard.agenda") },
    { to: "/dashboard/reservations", icon: BookmarkCheck, label: t("dashboard.reservations"), badge: pendingCount },
    { to: "/dashboard/forfaits", icon: Package, label: "Forfaits" },
    { to: "/dashboard/questionnaires", icon: ClipboardList, label: "Questionnaires" },
    { to: "/dashboard/facturation", icon: Receipt, label: "Facturation" },
    { to: "/dashboard/articles", icon: FileText, label: t("dashboard.articles") },
    { to: "/dashboard/avis", icon: Star, label: t("dashboard.reviews") },
    { to: "/dashboard/evenements", icon: CalendarDays, label: t("dashboard.events") },
    { to: "/dashboard/crm", icon: Crown, label: "CRM Elite" },
    { to: "/dashboard/abonnement", icon: CreditCard, label: t("dashboard.subscription") },
    { to: "/dashboard/parrainage", icon: Gift, label: t("dashboard.referral") },
  ];
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="h-16 flex items-center px-6 border-b border-border"><Logo /></div>
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
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-primary-xlight text-primary" : "text-foreground/70 hover:bg-muted hover:text-foreground"
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
          );
        })}
      </nav>
      <div className="border-t border-border p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary-xlight text-primary flex items-center justify-center text-sm font-semibold">T</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{t("dashboard.therapist_label")}</div>
          <div className="text-xs text-muted-foreground truncate">{t("dashboard.demo_account")}</div>
          <div className="mt-1"><AccountManageDialog /></div>
        </div>
        <Settings className="h-4 w-4 text-muted-foreground" />
      </div>
    </aside>
  );
}