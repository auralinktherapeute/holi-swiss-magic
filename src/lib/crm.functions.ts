import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

export type CrmLead = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  canton: string | null;
  specialty: string | null;
  source: string;
  status: "new" | "pending" | "contacted" | "followup" | "converted" | "elite_pro" | "suspended";
  priority: "low" | "normal" | "high";
  assigned_to: string | null;
  notes: string | null;
  last_contact_at: string | null;
  converted_therapist_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CrmActivity = {
  id: string;
  entity_type: "lead" | "therapist" | "client_contact";
  entity_id: string;
  owner_id: string | null;
  type: "email" | "call" | "note" | "status_change" | "task" | "booking" | "review" | "message";
  title: string;
  body: string | null;
  metadata: Record<string, string | number | boolean | null>;
  occurred_at: string;
};

export type CrmTask = {
  id: string;
  owner_id: string | null;
  therapist_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  description: string | null;
  due_at: string | null;
  done_at: string | null;
  priority: "low" | "normal" | "high";
};

const LEAD_STATUSES = ["new","pending","contacted","followup","converted","elite_pro","suspended"] as const;

export const listCrmLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string; status?: string; canton?: string; source?: string }) =>
    z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      canton: z.string().optional(),
      source: z.string().optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<CrmLead[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("crm_leads").select("*").order("created_at", { ascending: false }).limit(500);
    if (data.status) q = q.eq("status", data.status);
    if (data.canton) q = q.eq("canton", data.canton);
    if (data.source) q = q.eq("source", data.source);
    if (data.search && data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s},specialty.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmLead[];
  });

export const getCrmLeadDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lead, error } = await supabaseAdmin.from("crm_leads").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    const { data: activities } = await supabaseAdmin
      .from("crm_activities")
      .select("*")
      .eq("entity_type", "lead")
      .eq("entity_id", data.id)
      .order("occurred_at", { ascending: false })
      .limit(100);
    const { data: tasks } = await supabaseAdmin
      .from("crm_tasks")
      .select("*")
      .eq("entity_type", "lead")
      .eq("entity_id", data.id)
      .order("due_at", { ascending: true })
      .limit(50);
    return {
      lead: lead as CrmLead | null,
      activities: (activities ?? []) as CrmActivity[],
      tasks: (tasks ?? []) as CrmTask[],
    };
  });

export const createCrmLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<CrmLead>) =>
    z.object({
      first_name: z.string().trim().min(1).max(100),
      last_name: z.string().trim().min(1).max(100),
      email: z.string().email().max(255).optional().nullable(),
      phone: z.string().max(50).optional().nullable(),
      canton: z.string().max(50).optional().nullable(),
      specialty: z.string().max(120).optional().nullable(),
      source: z.string().max(50).default("manual"),
      priority: z.enum(["low","normal","high"]).default("normal"),
      notes: z.string().max(2000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin.from("crm_leads").insert(data).select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return row as CrmLead;
  });

export const updateCrmLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: typeof LEAD_STATUSES[number] }) =>
    z.object({ id: z.string().uuid(), status: z.enum(LEAD_STATUSES) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin.from("crm_leads").select("status").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin
      .from("crm_leads")
      .update({ status: data.status, last_contact_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("crm_activities").insert({
      entity_type: "lead",
      entity_id: data.id,
      owner_id: context.userId,
      type: "status_change",
      title: `Statut : ${prev?.status ?? "—"} → ${data.status}`,
      body: null,
      metadata: { from: prev?.status, to: data.status },
    });
    return { ok: true };
  });

export const addCrmNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entityType: "lead" | "therapist"; entityId: string; body: string; title?: string }) =>
    z.object({
      entityType: z.enum(["lead","therapist"]),
      entityId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
      title: z.string().max(200).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_activities").insert({
      entity_type: data.entityType,
      entity_id: data.entityId,
      owner_id: context.userId,
      type: "note",
      title: data.title ?? "Note interne",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createCrmTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { entityType?: string; entityId?: string; title: string; description?: string; due_at?: string; priority?: "low"|"normal"|"high" }) =>
    z.object({
      entityType: z.enum(["lead","therapist","client_contact"]).optional(),
      entityId: z.string().uuid().optional(),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(2000).optional(),
      due_at: z.string().datetime().optional(),
      priority: z.enum(["low","normal","high"]).default("normal"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("crm_tasks").insert({
      entity_type: data.entityType ?? null,
      entity_id: data.entityId ?? null,
      title: data.title,
      description: data.description ?? null,
      due_at: data.due_at ?? null,
      priority: data.priority,
      owner_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completeCrmTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; done: boolean }) =>
    z.object({ id: z.string().uuid(), done: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("crm_tasks")
      .update({ done_at: data.done ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCrmAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 30 * 86400_000).toISOString();
    const [leadsTotal, newThisMonth, converted, elitePro, openTasks, overdueTasks] = await Promise.all([
      supabaseAdmin.from("crm_leads").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("crm_leads").select("id", { count: "exact", head: true }).gte("created_at", since),
      supabaseAdmin.from("crm_leads").select("id", { count: "exact", head: true }).in("status", ["converted","elite_pro"]),
      supabaseAdmin.from("therapists").select("id", { count: "exact", head: true }).eq("subscription_plan", "elite_pro"),
      supabaseAdmin.from("crm_tasks").select("id", { count: "exact", head: true }).is("done_at", null),
      supabaseAdmin.from("crm_tasks").select("id", { count: "exact", head: true }).is("done_at", null).lt("due_at", new Date().toISOString()),
    ]);
    const total = leadsTotal.count ?? 0;
    const conv = converted.count ?? 0;
    return {
      leadsTotal: total,
      leadsLast30: newThisMonth.count ?? 0,
      conversionRate: total > 0 ? Math.round((conv / total) * 100) : 0,
      elitePro: elitePro.count ?? 0,
      openTasks: openTasks.count ?? 0,
      overdueTasks: overdueTasks.count ?? 0,
    };
  });

export const listAdminTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CrmTask[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("crm_tasks")
      .select("*")
      .is("therapist_id", null)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as CrmTask[];
  });

/** Centre des tâches admin — toutes tâches (non liées à un thérapeute) + filtres. */
export const listAdminTasksAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: "open" | "done" | "overdue"; priority?: "low" | "normal" | "high" }) =>
    z.object({
      status: z.enum(["open","done","overdue"]).optional(),
      priority: z.enum(["low","normal","high"]).optional(),
    }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<CrmTask[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("crm_tasks").select("*").is("therapist_id", null).limit(200);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.status === "open") q = q.is("done_at", null);
    if (data.status === "done") q = q.not("done_at", "is", null);
    if (data.status === "overdue") q = q.is("done_at", null).lt("due_at", new Date().toISOString());
    q = q.order("due_at", { ascending: true, nullsFirst: false });
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as CrmTask[];
  });

/** Centre de relances admin — leads en statut followup + leads sans contact > seuil. */
export const listAdminRelances = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const thresholds = [7, 14, 30];
    const since = (days: number) => new Date(Date.now() - days * 86400_000).toISOString();
    const [followup, stale7, stale14, stale30] = await Promise.all([
      supabaseAdmin.from("crm_leads").select("*").eq("status", "followup").order("updated_at", { ascending: true }).limit(200),
      supabaseAdmin.from("crm_leads").select("id,first_name,last_name,email,canton,specialty,status,priority,last_contact_at,created_at", { count: "exact", head: false })
        .in("status", ["new","pending","contacted"]).lt("created_at", since(7)).is("last_contact_at", null).limit(200),
      supabaseAdmin.from("crm_leads").select("id", { count: "exact", head: true }).in("status", ["new","pending","contacted"]).lt("created_at", since(14)),
      supabaseAdmin.from("crm_leads").select("id", { count: "exact", head: true }).in("status", ["new","pending","contacted"]).lt("created_at", since(30)),
    ]);
    return {
      followup: (followup.data ?? []) as CrmLead[],
      staleLeads: (stale7.data ?? []) as CrmLead[],
      buckets: { d7: (stale7.data ?? []).length, d14: stale14.count ?? 0, d30: stale30.count ?? 0 },
      thresholds,
    };
  });