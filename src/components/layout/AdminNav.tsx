import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Star, FileText, CalendarDays, UserCog,
  CreditCard, Bot, Mail, ShieldAlert, Settings, LogOut, Hourglass,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function AdminNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const email = user?.email ?? "admin@holiswiss.ch";
  const initial = email.charAt(0).toUpperCase();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/$lang", params: { lang: "fr" } });
  };
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.rpc("waiting_list_count");
      if (!cancelled && typeof data === "number") setWaitlistCount(data);
    };
    load();
    const ch = supabase
      .channel("admin-waitlist-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "waiting_list" }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, []);
  const items = [
    { to: "/admin", icon: LayoutDashboard, label: t("admin.overview"), exact: true },
    { to: "/admin/therapeutes", icon: Users, label: t("admin.therapists") },
    { to: "/admin/liste-attente", icon: Hourglass, label: t("admin.waitlist"), badge: waitlistCount ?? undefined, badgeVariant: "violet" as const },
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
    <aside
      className="hidden md:flex w-64 shrink-0 flex-col text-sidebar-foreground"
      style={{ background: "#0f0a1e", borderRight: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="h-16 flex items-center px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-1.5 text-xl font-bold">
          <span aria-hidden className="text-2xl drop-shadow-[0_0_8px_rgba(124,58,237,0.6)]">🌿</span>
          <span style={{ color: "#b86ef9" }}>Holiswiss</span>
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
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    (it as any).badgeVariant === "violet"
                      ? "text-white"
                      : "bg-destructive text-destructive-foreground"
                  }`}
                  style={(it as any).badgeVariant === "violet" ? { background: "#b86ef9" } : undefined}
                >
                  {it.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">{initial}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">Admin</div>
          <div className="text-xs text-sidebar-foreground/60 truncate">{email}</div>
        </div>
        <button
          onClick={signOut}
          aria-label="Se déconnecter"
          className="rounded-md p-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}