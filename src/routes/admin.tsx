import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminNav } from "@/components/layout/AdminNav";
import { checkIsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="dark" style={{ ["--admin-bg" as any]: "#07040f" }}>
      <div
        className="flex min-h-dvh w-full text-foreground"
        style={{ background: "#07040f" }}
      >
        <AdminNav />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
