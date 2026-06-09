import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminNav } from "@/components/layout/AdminNav";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    let result: Awaited<ReturnType<typeof checkIsAdmin>>;
    try {
      result = await checkIsAdmin();
    } catch {
      throw redirect({ to: "/$lang/connexion", params: { lang: "fr" } });
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
