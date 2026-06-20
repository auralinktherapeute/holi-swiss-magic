import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminNav } from "@/components/layout/AdminNav";
import { checkIsAdmin } from "@/lib/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { LoadingScreen } from "@/components/holiswiss/LoadingScreen";
import { InactivityLogout } from "@/components/holiswiss/InactivityLogout";
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
  const [errMsg, setErrMsg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    check()
      .then((r) => {
        if (!alive) return;
        if (!r.isAdmin) {
          console.warn("[admin] access denied — user is not admin", r);
          setErrMsg("Votre compte n'a pas le rôle administrateur.");
        }
        setState(r.isAdmin ? "ok" : "deny");
      })
      .catch((e) => {
        if (!alive) return;
        console.error("[admin] checkIsAdmin failed", e);
        setErrMsg(e?.message || "Erreur inconnue lors de la vérification du rôle.");
        setState("deny");
      }); // fail-closed: ne pas exposer l'UI admin sur erreur
    return () => {
      alive = false;
    };
  }, [check]);
  if (state === "deny") {
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#0f0a1e", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 480, textAlign: "center", display: "grid", gap: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Accès administrateur indisponible</h1>
          <p style={{ opacity: 0.85, fontSize: 14 }}>
            {errMsg ?? "Impossible de vérifier votre rôle administrateur."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => { setState("loading"); setErrMsg(null); check().then((r) => { setState(r.isAdmin ? "ok" : "deny"); if (!r.isAdmin) setErrMsg("Votre compte n'a pas le rôle administrateur."); }).catch((e) => { setErrMsg(e?.message || "Erreur inconnue."); setState("deny"); }); }}
              style={{ padding: "10px 16px", borderRadius: 8, background: "#b86ef9", color: "#0f0a1e", fontWeight: 600, border: 0, cursor: "pointer" }}
            >
              Réessayer
            </button>
            <a href="/fr/connexion" style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.3)", color: "#fff", textDecoration: "none" }}>
              Se reconnecter
            </a>
            <a href="/fr" style={{ padding: "10px 16px", borderRadius: 8, color: "#fff", textDecoration: "underline", alignSelf: "center" }}>
              Retour au site
            </a>
          </div>
        </div>
      </div>
    );
  }
  if (state === "loading") return <LoadingScreen />;
  return (
    <div className="adm-root" style={{ display: "flex", minHeight: "100dvh", background: "#0f0a1e" }}>
      <AdminNav />
      <main style={{ flex: 1, overflowX: "hidden" }}>
        <Outlet />
      </main>
      <InactivityLogout redirectTo="/fr/connexion" />
    </div>
  );
}
