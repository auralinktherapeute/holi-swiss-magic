import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

// Les tables de l'agent « Santé de Profil » ne sont pas encore dans types.ts
// (généré par Lovable). On lit via supabaseAdmin (service-role) car ces tables
// sont en RLS admin-only. Cast local pour ne pas casser le typecheck.
const SEV_RANK: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export const listHealthScores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await sb
      .from("therapist_health_scores")
      .select(
        "therapist_id,score_total,grade,score_completude,score_contenu,score_activite,score_visibilite,computed_at,therapists(first_name,last_name,canton,slug)",
      )
      .order("score_total", { ascending: true });
    if (error) throw new Error(error.message);
    return {
      rows: (data ?? []).map((r: any) => ({
        therapist_id: r.therapist_id as string,
        name: `${r.therapists?.first_name ?? ""} ${r.therapists?.last_name ?? ""}`.trim(),
        canton: (r.therapists?.canton ?? "") as string,
        slug: (r.therapists?.slug ?? "") as string,
        score: r.score_total as number,
        grade: r.grade as "green" | "orange" | "red",
        breakdown: {
          completude: r.score_completude as number,
          contenu: r.score_contenu as number,
          activite: r.score_activite as number,
          visibilite: r.score_visibilite as number,
        },
      })),
    };
  });

export const getHealthDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const [scoreRes, therRes, recoRes, histRes] = await Promise.all([
      sb.from("therapist_health_scores").select("*").eq("therapist_id", data.therapistId).maybeSingle(),
      sb
        .from("therapists")
        .select("id,user_id,first_name,last_name,email,phone,address,city,canton,created_at,slug,specialties,languages,is_premium")
        .eq("id", data.therapistId)
        .maybeSingle(),
      sb.from("therapist_health_recommendations").select("*").eq("therapist_id", data.therapistId),
      sb
        .from("therapist_health_score_history")
        .select("score_total,computed_at")
        .eq("therapist_id", data.therapistId)
        .order("computed_at", { ascending: false })
        .limit(12),
    ]);
    let plan = "basic";
    if (therRes.data?.user_id) {
      const { data: sub } = await sb.from("subscriptions").select("plan").eq("user_id", therRes.data.user_id).maybeSingle();
      if (sub?.plan) plan = sub.plan as string;
    }
    const recommendations = ((recoRes.data ?? []) as any[]).sort(
      (a, b) => (SEV_RANK[a.severity] ?? 3) - (SEV_RANK[b.severity] ?? 3) || b.impact_points - a.impact_points,
    );
    return {
      score: scoreRes.data as any,
      therapist: therRes.data as any,
      plan,
      recommendations,
      history: (histRes.data ?? []) as any[],
    };
  });

export const updateRecommendationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ id: z.string().uuid(), status: z.enum(["todo", "in_progress", "resolved", "dismissed"]) }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { error } = await sb
      .from("therapist_health_recommendations")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runHealthScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data, error } = await sb.rpc("compute_therapist_health");
    if (error) throw new Error(error.message);
    return { processed: (data as number) ?? 0 };
  });
