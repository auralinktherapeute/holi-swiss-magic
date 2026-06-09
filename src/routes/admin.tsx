import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AdminNav } from "@/components/layout/AdminNav";
import { useAuth } from "@/hooks/use-auth";
import { checkIsAdmin } from "@/lib/admin.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const check = useServerFn(checkIsAdmin);
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/$lang/connexion", params: { lang: "fr" } });
      return;
    }
    let cancelled = false;
    check()
      .then((r) => {
        if (cancelled) return;
        if (r.isAdmin) setState("ok");
        else {
          setState("denied");
          navigate({ to: "/$lang", params: { lang: "fr" } });
        }
      })
      .catch(() => {
        if (cancelled) return;
        setState("denied");
        navigate({ to: "/$lang", params: { lang: "fr" } });
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading, navigate, check]);

  return (
    <div className="dark" style={{ ["--admin-bg" as any]: "#07040f" }}>
      <div
        className="flex min-h-dvh w-full text-foreground"
        style={{ background: "#07040f" }}
      >
        {state === "ok" ? (
          <>
            <AdminNav />
            <main className="flex-1 overflow-x-hidden">
              <Outlet />
            </main>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {state === "denied" ? "Accès refusé. Redirection…" : "Vérification des accès…"}
          </div>
        )}
      </div>
    </div>
  );
}
