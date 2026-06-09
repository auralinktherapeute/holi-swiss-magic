import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard, Users, Star, FileText, CalendarDays, UserCog,
  CreditCard, Bot, Mail, ShieldAlert, Settings, LogOut,
} from "lucide-react";

export function AdminNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/admin", icon: LayoutDashboard, label: t("admin.overview"), exact: true },
    { to: "/admin/therapeutes", icon: Users, label: t("admin.therapists") },
    { to: "/admin/avis", icon: Star, label: t("admin.reviews") },
    { to: "/admin/articles", icon: FileText, label: t("admin.articles") },
    { to: "/admin/evenements", icon: CalendarDays, label: t("admin.events") },
    { to: "/admin/utilisateurs", icon: UserCog, label: t("admin.users") },
    { to: "/admin/abonnements", icon: CreditCard, label: t("admin.subscriptions") },
    { to: "/admin/agents", icon: Bot, label: t("admin.agents") },
    { to: "/admin/emails", icon: Mail, label: t("admin.emails") },
    { to: "/admin/moderation", icon: ShieldAlert, label: t("admin.moderation"), badge: 3 },
    { to: "/admin/parametres", icon: Settings, label: t("admin.settings") },
  ];
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-1.5 text-xl font-bold">
          <span aria-hidden className="text-2xl drop-shadow-[0_0_8px_rgba(124,58,237,0.6)]">🌿</span>
          <span className="text-primary-light">Holi</span>
          <span className="text-white font-normal">swiss</span>
        </div>
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
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
              {it.badge ? (
                <span className="rounded-full bg-destructive text-destructive-foreground px-2 py-0.5 text-[10px] font-semibold">
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">A</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">Admin</div>
          <div className="text-xs text-sidebar-foreground/60 truncate">admin@holiswiss.ch</div>
        </div>
        <LogOut className="h-4 w-4 text-sidebar-foreground/60" />
      </div>
    </aside>
  );
}