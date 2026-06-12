import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminNav } from "@/components/layout/AdminNav";
import { checkIsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    // Gate local : la session doit exister côté client avant tout appel serveur.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
    }
    let result: Awaited<ReturnType<typeof checkIsAdmin>>;
    try {
      result = await checkIsAdmin();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.toLowerCase().includes("unauthorized")) {
        throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
      }
      console.warn("[admin.beforeLoad] validation serveur a échoué (réseau ?):", err);
      return;
    }
    if (!result.isAdmin) {
      throw redirect({ to: "/$lang", params: { lang: "fr" } });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="adm-root" style={{ display: "flex", minHeight: "100dvh", background: "#0f0a1e" }}>
      <AdminNav />
      <main style={{ flex: 1, overflowX: "hidden" }}>
        <Outlet />
      </main>
    </div>
  );
}
