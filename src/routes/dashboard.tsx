import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { TherapistNav } from "@/components/layout/TherapistNav";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard")({ component: DashboardLayout });

function DashboardLayout() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Chargement…
      </div>
    );
  }
  if (!user) return <Navigate to="/$lang/connexion" params={{ lang: "fr" }} />;
  return (
    <div className="flex min-h-screen w-full bg-background">
      <TherapistNav />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
