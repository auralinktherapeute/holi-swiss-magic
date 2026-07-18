import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { TherapistNav } from "@/components/layout/TherapistNav";
import { MobileDashboardHeader, MobileDashboardBottomNav } from "@/components/layout/MobileDashboardNav";
import { useAuth } from "@/hooks/use-auth";
import { isLang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/holiswiss/LoadingScreen";
import { InactivityLogout } from "@/components/holiswiss/InactivityLogout";
import { useServerFn } from "@tanstack/react-start";
import { ensureMyTherapistShell } from "@/lib/dashboard.functions";
import { getOnboardingState } from "@/lib/onboarding.functions";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { RequireRole } from "@/components/auth/RequireRole";
import { requireCurrentRole } from "@/lib/auth-utils";
import { ensureTherapistRole } from "@/lib/auth-role.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    // Seule la session locale est vérifiée ici pour éviter toute déconnexion
    // intempestive lors de la navigation. Les server functions appelées
    // ensuite valident le token côté serveur (requireSupabaseAuth).
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      let hasTherapistRole = false;
      try {
        hasTherapistRole = Boolean(await requireCurrentRole("therapist"));
      } catch {
        hasTherapistRole = false;
      }
      if (hasTherapistRole) return;
      // Self-heal : comptes créés sans ligne user_roles (inscription directe
      // ou Google hors invitation) — le serveur attribue le rôle manquant.
      let healedRole: string | null = null;
      try {
        healedRole = (await ensureTherapistRole()).role;
      } catch {
        healedRole = null;
      }
      if (healedRole === "therapist") return;
      if (healedRole === "admin") throw redirect({ to: "/admin" });
    }
    throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { loading } = useAuth();
  const { i18n } = useTranslation();
  const ensureShell = useServerFn(ensureMyTherapistShell);
  const fetchState = useServerFn(getOnboardingState);
  const qc = useQueryClient();
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    if (loading) return;
    (ensureShell as any)().catch(() => {});
  }, [loading, ensureShell]);
  const { data: onboarding } = useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => fetchState(),
    enabled: !loading,
    staleTime: 30_000,
  });
  useEffect(() => {
    if (onboarding && !onboarding.onboarding_complete) {
      setTourOpen(true);
    }
  }, [onboarding]);
  useEffect(() => {
    const handler = () => setTourOpen(true);
    window.addEventListener("holiswiss:start-tour", handler);
    return () => window.removeEventListener("holiswiss:start-tour", handler);
  }, []);
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
    <RequireRole role="therapist" redirectTo="/fr/connexion">
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
        <OnboardingTour
          open={tourOpen}
          onClose={() => {
            setTourOpen(false);
            qc.invalidateQueries({ queryKey: ["onboarding-state"] });
          }}
        />
      </div>
    </RequireRole>
  );
}
