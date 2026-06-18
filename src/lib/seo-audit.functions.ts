import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

export type SeoFinding = {
  id: string;
  code: string;
  category: "seo_onpage" | "seo_technical" | "seo_local" | "geo" | "multilang" | "accessibility";
  severity: "good" | "warning" | "critical";
  priority: "P1" | "P2" | "P3";
  title: string;
  description: string;
  action: string;
  status: "open" | "resolved";
  resolved_at: string | null;
};

export const listSeoFindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SeoFinding[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("seo_findings")
      .select("id,code,category,severity,priority,title,description,action,status,resolved_at")
      .order("priority", { ascending: true })
      .order("severity", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SeoFinding[];
  });

export const updateSeoFindingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; status: "open" | "resolved" }) =>
    z.object({
      code: z.string().min(1),
      status: z.enum(["open", "resolved"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("seo_findings")
      .update({
        status: data.status,
        resolved_at: data.status === "resolved" ? new Date().toISOString() : null,
        resolved_by: data.status === "resolved" ? context.userId : null,
      })
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });