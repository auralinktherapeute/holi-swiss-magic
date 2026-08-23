import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const adminSectionSchema = z.enum(["waitlist", "reviews", "articles"]);

export const getPersistentAdminBadgeCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: reads } = await db
      .from("admin_section_reads")
      .select("section,last_seen_at")
      .eq("user_id", context.userId);
    const seen = new Map<string, string>((reads ?? []).map((row: any) => [row.section, row.last_seen_at]));

    const afterLastSeen = (query: any, section: string, timestampColumn = "created_at") => {
      const lastSeenAt = seen.get(section);
      return lastSeenAt ? query.gt(timestampColumn, lastSeenAt) : query;
    };

    const [therapists, waitlist, events, articles, pendingReviews, pendingReplies] = await Promise.all([
      db.from("therapists").select("id", { count: "exact", head: true }).eq("status", "pending"),
      afterLastSeen(
        db.from("waiting_list").select("id", { count: "exact", head: true }).eq("status", "pending"),
        "waitlist",
        "updated_at",
      ),
      db.from("events").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
      afterLastSeen(
        db.from("articles").select("id", { count: "exact", head: true }).eq("status", "pending_validation"),
        "articles",
        "updated_at",
      ),
      afterLastSeen(
        db.from("reviews").select("id", { count: "exact", head: true }).eq("status", "pending"),
        "reviews",
        "updated_at",
      ),
      afterLastSeen(
        db.from("reviews").select("id", { count: "exact", head: true }).eq("therapist_reply_status", "pending"),
        "reviews",
        "therapist_reply_submitted_at",
      ),
    ]);

    return {
      therapists: therapists.count ?? 0,
      waitlist: waitlist.count ?? 0,
      events: events.count ?? 0,
      moderation: 0,
      reviews: (pendingReviews.count ?? 0) + (pendingReplies.count ?? 0),
      articles: articles.count ?? 0,
      subscriptions: 0,
    };
  });

export const markAdminSectionRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ section: adminSectionSchema }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("admin_section_reads").upsert(
      {
        user_id: context.userId,
        section: data.section,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,section" },
    );
    if (error) throw new Error("Impossible d’acquitter cette rubrique.");
    return { ok: true };
  });