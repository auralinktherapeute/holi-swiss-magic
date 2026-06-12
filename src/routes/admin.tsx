import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminNav } from "@/components/layout/AdminNav";
import { checkIsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/holiswiss/LoadingScreen";
import "@/styles/admin-design-system.css";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    // Seule la session locale est vérifiée ici : pas d'appel serveur synchrone,
    // pour éviter toute redirection intempestive entre les pages admin.
    // La vérification du rôle admin est faite une seule fois dans le composant,
    // et chaque server fn admin assert le rôle côté serveur.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const check = useServerFn(checkIsAdmin);
  const [state, setState] = useState<"loading" | "ok" | "deny">("loading");
  useEffect(() => {
    let alive = true;
    check()
      .then((r) => {
        if (!alive) return;
        setState(r.isAdmin ? "ok" : "deny");
      })
      .catch(() => alive && setState("ok")); // blip réseau : ne pas déconnecter
    return () => {
      alive = false;
    };
  }, [check]);
  if (state === "deny") {
    if (typeof window !== "undefined") window.location.replace("/fr");
    return <LoadingScreen />;
  }
  if (state === "loading") return <LoadingScreen />;
  return (
    <div className="adm-root" style={{ display: "flex", minHeight: "100dvh", background: "#0f0a1e" }}>
      <AdminNav />
      <main style={{ flex: 1, overflowX: "hidden" }}>
        <Outlet />
      </main>
    </div>
  );
}
