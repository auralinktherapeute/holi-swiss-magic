import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminNav } from "@/components/layout/AdminNav";
import { supabase } from "@/integrations/supabase/client";
import { InactivityLogout } from "@/components/holiswiss/InactivityLogout";
import { RequireRole } from "@/components/auth/RequireRole";
import { requireCurrentRole } from "@/lib/auth-utils";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    // Seule la session locale est vérifiée ici : pas d'appel serveur synchrone,
    // pour éviter toute redirection intempestive entre les pages admin.
    // La vérification du rôle admin est faite une seule fois dans le composant,
    // et chaque server fn admin assert le rôle côté serveur.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session || !(await requireCurrentRole("admin"))) {
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
