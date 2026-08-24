import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminNav } from "@/components/layout/AdminNav";
import { supabase } from "@/integrations/supabase/client";
import { InactivityLogout } from "@/components/holiswiss/InactivityLogout";
import { RequireRole } from "@/components/auth/RequireRole";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    // La garde de route ne tranche que sur l'existence de la session locale.
    // Le rôle est vérifié par RequireRole et par chaque fonction serveur. Une
    // lecture de rôle momentanément indisponible ne doit jamais expulser un
    // administrateur authentifié pendant la navigation.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <RequireRole role="admin" redirectTo="/fr/connexion">
      <div className="adm-root" style={{ display: "flex", minHeight: "100dvh", background: "#0f0a1e" }}>
        <AdminNav />
        <main style={{ flex: 1, overflowX: "hidden" }}>
          <Outlet />
        </main>
        <InactivityLogout redirectTo="/fr/connexion" />
      </div>
    </RequireRole>
  );
}
