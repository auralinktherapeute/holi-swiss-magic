import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { TherapistNav } from "@/components/layout/TherapistNav";
import { MobileDashboardHeader, MobileDashboardBottomNav } from "@/components/layout/MobileDashboardNav";
import { useAuth } from "@/hooks/use-auth";
import { isLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/holiswiss/LoadingScreen";
import { InactivityLogout } from "@/components/holiswiss/InactivityLogout";
import { useServerFn } from "@tanstack/react-start";
import { ensureMyTherapistShell } from "@/lib/dashboard.functions";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    // Seule la session locale est vérifiée ici pour éviter toute déconnexion
    // intempestive lors de la navigation. Les server functions appelées
    // ensuite valident le token côté serveur (requireSupabaseAuth).
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { loading } = useAuth();
  const { i18n } = useTranslation();
  const ensureShell = useServerFn(ensureMyTherapistShell);
  useEffect(() => {
    if (loading) return;
    (ensureShell as any)().catch(() => {});
  }, [loading, ensureShell]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("holiswiss-lang");
      if (stored && isLang(stored) && i18n.language.split("-")[0] !== stored) {
        i18n.changeLanguage(stored);
      }
    } catch {}
  }, [i18n]);
  if (loading) {
    return <LoadingScreen />;
  }
  return (
    <div className="flex min-h-screen w-full bg-background">
      <TherapistNav />
      <div className="flex flex-1 flex-col overflow-x-hidden">
        <MobileDashboardHeader />
        <main className="flex-1 pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>
      <MobileDashboardBottomNav />
      <InactivityLogout redirectTo="/fr/connexion" />
    </div>
  );
}
