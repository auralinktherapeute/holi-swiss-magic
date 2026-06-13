import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Star, FileText, CalendarDays, UserCog,
  CreditCard, Bot, Mail, ShieldAlert, Settings, LogOut, Hourglass,
  Menu, X, Home,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getWaitingListCount } from "@/lib/public.functions";

export function AdminNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const fetchWaitingListCount = useServerFn(getWaitingListCount);
  const email = user?.email ?? "admin@holiswiss.ch";
  const initial = email.charAt(0).toUpperCase();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/$lang", params: { lang: "fr" } });
  };

  const returnToSite = () => {
    setMobileOpen(false);
    try {
      window.localStorage.setItem("holiswiss-last-auth-space", "admin");
      window.localStorage.setItem("holiswiss-last-activity", String(Date.now()));
    } catch {}
  };

  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { count } = await fetchWaitingListCount();
      if (!cancelled) setWaitlistCount(count);
    };
    load();
    const id = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [fetchWaitingListCount]);

  const items = [
    { to: "/admin",                  icon: LayoutDashboard, label: t("admin.overview"),       exact: true },
    { to: "/admin/therapeutes",      icon: Users,           label: t("admin.therapists") },
    { to: "/admin/liste-attente",    icon: Hourglass,       label: t("admin.waitlist"),        badge: waitlistCount ?? undefined, badgeRed: false },
    { to: "/admin/moderation",       icon: ShieldAlert,     label: t("admin.moderation"),      badge: undefined, badgeRed: true },
    { to: "/admin/avis",             icon: Star,            label: t("admin.reviews") },
    { to: "/admin/articles",         icon: FileText,        label: t("admin.articles") },
    { to: "/admin/evenements",       icon: CalendarDays,    label: t("admin.events") },
    { to: "/admin/utilisateurs",     icon: UserCog,         label: t("admin.users") },
    { to: "/admin/abonnements",      icon: CreditCard,      label: t("admin.subscriptions") },
    { to: "/admin/agents",           icon: Bot,             label: t("admin.agents") },
    { to: "/admin/emails",           icon: Mail,            label: t("admin.emails") },
    { to: "/admin/parametres",       icon: Settings,        label: t("admin.settings") },
  ];

  const SidebarContent = () => (
    <div style={{
      width: 248,
      background: "#0d0820",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Logo */}
      <div style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        gap: 8,
      }}>
        <span style={{ fontSize: 22 }}>🌿</span>
        <span style={{
          fontSize: 16,
          fontWeight: 700,
          background: "linear-gradient(135deg, #b86ef9, #5cc8fa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          HoliSwiss
        </span>
        <span style={{
          marginLeft: "auto",
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(184,110,249,0.7)",
          background: "rgba(184,110,249,0.1)",
          padding: "2px 7px",
          borderRadius: 999,
          letterSpacing: "0.05em",
        }}>
          ADMIN
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
        <Link
          to="/$lang"
          params={{ lang: "fr" }}
          onClick={returnToSite}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 40,
            padding: "0 12px",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
            transition: "all 150ms ease",
            background: "rgba(92,200,250,0.08)",
            color: "#5cc8fa",
            marginBottom: 6,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(92,200,250,0.16)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(92,200,250,0.08)";
          }}
        >
          <Home size={16} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Retour au site</span>
        </Link>
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                height: 40,
                padding: "0 12px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                transition: "all 150ms ease",
                borderLeft: `2px solid ${active ? "#b86ef9" : "transparent"}`,
                background: active ? "rgba(184,110,249,0.12)" : "transparent",
                color: active ? "#ffffff" : "rgba(255,255,255,0.6)",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLElement).style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)";
                }
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.label}
              </span>
              {item.badge != null && item.badge > 0 && (
                <span style={{
                  background: item.badgeRed ? "rgba(248,113,113,0.2)" : "rgba(184,110,249,0.2)",
                  color: item.badgeRed ? "#f87171" : "#b86ef9",
                  borderRadius: 999,
                  padding: "1px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: 12,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #b86ef9, #5cc8fa)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: 14,
          flexShrink: 0,
        }}>
          {initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Admin</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
        </div>
        <button
          onClick={signOut}
          title="Se déconnecter"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.4)",
            borderRadius: 8,
            padding: 6,
            display: "flex",
            alignItems: "center",
            transition: "all 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.12)";
            (e.currentTarget as HTMLElement).style.color = "#f87171";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "none";
            (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)";
          }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile burger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: "rgba(13,8,32,0.95)",
            border: "1px solid rgba(184,110,249,0.3)",
            borderRadius: 10,
            padding: 8,
            color: "#b86ef9",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ position: "fixed", left: 0, top: 0, zIndex: 50 }}
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
