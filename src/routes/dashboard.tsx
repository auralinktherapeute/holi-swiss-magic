import { createFileRoute, Outlet } from "@tanstack/react-router";
import { TherapistNav } from "@/components/layout/TherapistNav";

export const Route = createFileRoute("/dashboard")({ component: DashboardLayout });

function DashboardLayout() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <TherapistNav />
      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
