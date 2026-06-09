import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function throwAdminOperationError(error: unknown, context: string): never {
  console.error(`[admin] ${context}:`, error);
  throw new Error("Une erreur est survenue. Veuillez réessayer.");
}

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throwAdminOperationError(error, "role check failed");
  if (!data) throw new Error("Accès refusé.");
}

export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) return { isAdmin: false };
    return { isAdmin: !!data, userId: context.userId };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const sinceMonth = new Date();
    sinceMonth.setDate(1);
    sinceMonth.setHours(0, 0, 0, 0);
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalT, activeT, pendingT, apptsMonth, newT7] = await Promise.all([
      supabaseAdmin.from("therapists").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("therapists").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("therapists").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }).gte("created_at", sinceMonth.toISOString()),
      supabaseAdmin.from("therapists").select("id", { count: "exact", head: true }).gte("created_at", since7.toISOString()),
    ]);

    const { data: lastT } = await supabaseAdmin
      .from("therapists")
      .select("id,first_name,last_name,canton,created_at,status,slug")
      .order("created_at", { ascending: false })
      .limit(5);

    const { data: lastA } = await supabaseAdmin
      .from("appointments")
      .select("id,patient_name,appointment_date,appointment_time,status,therapist_id")
      .order("created_at", { ascending: false })
      .limit(5);

    // 7-day spark data for therapist signups
    const { data: rawSignups } = await supabaseAdmin
      .from("therapists")
      .select("created_at")
      .gte("created_at", since7.toISOString());
    const spark: { d: string; v: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      spark.push({ d: key, v: 0 });
    }
    (rawSignups ?? []).forEach((r: any) => {
      const key = String(r.created_at).slice(0, 10);
      const s = spark.find((x) => x.d === key);
      if (s) s.v++;
    });

    return {
      totalTherapists: totalT.count ?? 0,
      activeTherapists: activeT.count ?? 0,
      pendingTherapists: pendingT.count ?? 0,
      appointmentsThisMonth: apptsMonth.count ?? 0,
      newSignups7d: newT7.count ?? 0,
      revenueMrr: 0,
      lastTherapists: lastT ?? [],
      lastAppointments: lastA ?? [],
      signupsSparkline: spark,
    };
  });

export const listTherapistsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      status: z.string().optional(),
      canton: z.string().optional(),
      search: z.string().optional(),
      page: z.number().int().min(1).default(1),
      pageSize: z.number().int().min(1).max(100).default(20),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = supabaseAdmin
      .from("therapists")
      .select("id,user_id,slug,first_name,last_name,email,canton,status,verified,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.canton && data.canton !== "all") q = q.eq("canton", data.canton);
    if (data.search) {
      const s = data.search.replace(/[%_]/g, "");
      q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%`);
    }
    const { data: rows, count, error } = await q;
    if (error) throwAdminOperationError(error, "list therapists failed");
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const updateTherapistStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["active", "pending", "suspended", "rejected"]),
      reason: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("therapists")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throwAdminOperationError(error, "update therapist status failed");
    return { ok: true };
  });

export const listUsersAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ page: z.number().int().min(1).default(1), perPage: z.number().int().min(1).max(200).default(50) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: data.page, perPage: data.perPage });
    if (error) throwAdminOperationError(error, "list users failed");
    const ids = list.users.map((u) => u.id);
    const { data: roleRows } = await supabaseAdmin.from("user_roles").select("user_id,role").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const rolesByUser = new Map<string, string[]>();
    (roleRows ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });
    return {
      users: list.users.map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: (u as any).banned_until ?? null,
        roles: rolesByUser.get(u.id) ?? [],
      })),
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "moderator", "therapist", "user"]),
      enabled: z.boolean(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enabled) {
      const { error } = await supabaseAdmin.from("user_roles").upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throwAdminOperationError(error, "set user role failed");
    } else {
      const { error } = await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", data.role);
      if (error) throwAdminOperationError(error, "remove user role failed");
    }
    return { ok: true };
  });

export const deleteUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Cannot delete your own account");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throwAdminOperationError(error, "delete user failed");
    return { ok: true };
  });

export const banUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), ban: z.boolean() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.ban ? "8760h" : "none",
    } as any);
    if (error) throwAdminOperationError(error, "ban user failed");
    return { ok: true };
  });