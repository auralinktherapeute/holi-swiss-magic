import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminNav } from "@/components/layout/AdminNav";

export const Route = createFileRoute("/admin")({ component: AdminLayout });

function AdminLayout() {
  // Force dark theme scope for entire admin subtree
  return (
    <div className="dark">
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AdminNav />
        <main className="flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
