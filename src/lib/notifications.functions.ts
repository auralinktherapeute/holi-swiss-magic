import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

export const getUnreadNotificationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);
    return { count: count ?? 0 };
  });

export const listNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      filter: z.enum(["all", "unread"]).default("all"),
      kind: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("notifications")
      .select("id,kind,subject,summary,link,entity_type,entity_id,is_read,read_at,created_at,data")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.filter === "unread") q = q.eq("is_read", false);
    if (data.kind) q = q.eq("kind", data.kind);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => r.id);
    let deliveriesByNotif: Record<string, Array<{ channel: string; status: string; error_message: string | null; sent_at: string | null }>> = {};
    if (ids.length) {
      const { data: dels } = await supabaseAdmin
        .from("notification_deliveries")
        .select("notification_id,channel,status,error_message,sent_at")
        .in("notification_id", ids);
      (dels ?? []).forEach((d: any) => {
        (deliveriesByNotif[d.notification_id] ||= []).push({
          channel: d.channel, status: d.status, error_message: d.error_message, sent_at: d.sent_at,
        });
      });
    }
    return { rows: (rows ?? []).map((r) => ({ ...r, deliveries: deliveriesByNotif[r.id] ?? [] })) };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() } as never)
      .eq("id", data.id);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() } as never)
      .eq("is_read", false);
    return { ok: true };
  });