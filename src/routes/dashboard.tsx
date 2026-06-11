import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { TherapistNav } from "@/components/layout/TherapistNav";
import { useAuth } from "@/hooks/use-auth";
import { isLang } from "@/lib/i18n";
import { requireDashboardAuth } from "@/lib/dashboard.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  beforeLoad: async () => {
    // Étape 1 : vérifier la session locale (hydratée depuis localStorage).
    // Évite une redirection vers /connexion lors d'une simple navigation
    // entre pages du dashboard à cause d'une race ou d'un blip réseau.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
    }
    // Étape 2 : validation serveur (token réellement valide côté Supabase).
    try {
      await requireDashboardAuth();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      // Ne rediriger que sur des erreurs d'auth réelles, pas sur un blip réseau.
      if (msg.toLowerCase().includes("unauthorized")) {
        throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
      }
      // Sinon : laisser la session locale faire foi, ne pas déconnecter l'utilisateur.
      console.warn("[dashboard.beforeLoad] validation serveur a échoué (réseau ?):", err);
    }
  },
  component: DashboardLayout,
});

function DashboardLayout() {
  const { loading } = useAuth();
  const { t, i18n } = useTranslation();
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
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }
  return (
    <div className="flex min-h-screen w-full bg-background">
      <TherapistNav />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
