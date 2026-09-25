import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

/**
 * Contrôle « ville × NPA » des fiches thérapeutes (admin, lecture seule).
 * Signale sans rien corriger : la ville alimente les slugs /ville/…, une
 * correction doit rester une décision (voir src/lib/city-slug.ts).
 */
export const listCityAnomalies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ auditTherapistCity }, { getSwissNpaIndex, SWISS_NPA_SOURCE }] = await Promise.all([
      import("@/lib/city-audit"),
      import("@/lib/swiss-npa"),
    ]);
    const { data, error } = await supabaseAdmin
      .from("therapists")
      .select("id,first_name,last_name,slug,status,city,postal_code,canton")
      .in("status", ["active", "pending"])
      .order("status", { ascending: true });
    if (error) throw new Error("Lecture des fiches impossible.");

    const index = getSwissNpaIndex();
    const rank = { critical: 0, warning: 1, info: 2 } as const;
    const rows = (data ?? [])
      .map((t: any) => {
        const audit = auditTherapistCity(index, {
          city: t.city, postal_code: t.postal_code, canton: t.canton, status: t.status,
        });
        const worst = audit.issues.reduce<number>((m, i) => Math.min(m, rank[i.severity]), 3);
        return {
          id: t.id as string,
          name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim(),
          slug: t.slug as string | null,
          status: t.status as string,
          city: t.city as string | null,
          postal_code: t.postal_code as string | null,
          canton: t.canton as string | null,
          worst,
          ...audit,
        };
      })
      .filter((r) => r.issues.length > 0)
      .sort((a, b) => a.worst - b.worst || (a.status === "active" ? -1 : 1) - (b.status === "active" ? -1 : 1));

    return { checked: (data ?? []).length, rows, source: SWISS_NPA_SOURCE };
  });
