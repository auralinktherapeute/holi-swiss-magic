import { createFileRoute, Outlet, Navigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { TherapistNav } from "@/components/layout/TherapistNav";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard")({ component: DashboardLayout });

function DashboardLayout() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {t("common.loading")}
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
