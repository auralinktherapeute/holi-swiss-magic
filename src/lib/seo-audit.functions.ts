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

export type SeoHistoryPoint = {
  date: string;       // ISO yyyy-mm-dd
  seo: number;
  geo: number;
  global: number;
  hasReport: boolean; // whether a full report exists for that day
};

export const getSeoHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { days: number }) =>
    z.object({ days: z.number().int().min(1).max(365) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SeoHistoryPoint[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date();
    since.setDate(since.getDate() - (data.days - 1));
    const sinceStr = since.toISOString().slice(0, 10);

    const { data: rows, error } = await supabaseAdmin
      .from("seo_audit_history")
      .select("audit_date,seo_score,geo_score,global_score,summary")
      .gte("audit_date", sinceStr)
      .order("audit_date", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      date: r.audit_date as string,
      seo: r.seo_score as number,
      geo: r.geo_score as number,
      global: r.global_score as number,
      hasReport: !!r.summary,
    }));
  });

export type LatestAudit = {
  global: number;
  seo: number;
  geo: number;
  lastAuditAt: string | null;
  critical_count: number;
  resolved_count: number;
};

export const getLatestAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LatestAudit> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("seo_audit_history")
      .select("audit_date,seo_score,geo_score,global_score,critical_count,resolved_count,created_at")
      .order("audit_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      return { global: 0, seo: 0, geo: 0, lastAuditAt: null, critical_count: 0, resolved_count: 0 };
    }
    return {
      global: data.global_score as number,
      seo: data.seo_score as number,
      geo: data.geo_score as number,
      lastAuditAt: (data.created_at as string) ?? null,
      critical_count: (data.critical_count as number) ?? 0,
      resolved_count: (data.resolved_count as number) ?? 0,
    };
  });

export type RunAuditResult = {
  seo_score: number;
  geo_score: number;
  global_score: number;
  critical_count: number;
  resolved_count: number;
  audited_urls: number;
  audit_date: string;
};

export const runSeoAuditNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RunAuditResult> => {
    await assertAdmin(context.userId);
    const { runSeoAudit, getPreviousCriticalCodes, notifyCriticalIssues } =
      await import("@/lib/seo-audit-runner.server");
    const prev = await getPreviousCriticalCodes();
    const r = await runSeoAudit();
    await notifyCriticalIssues(prev, r.issues);
    return {
      seo_score: r.seo_score,
      geo_score: r.geo_score,
      global_score: r.global_score,
      critical_count: r.critical_count,
      resolved_count: r.resolved_count,
      audited_urls: r.audited_urls,
      audit_date: r.audit_date,
    };
  });