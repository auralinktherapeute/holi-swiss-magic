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
        "therapist_id,score_total,score_previous,last_recap_sent_at,grade,score_completude,score_contenu,score_activite,score_visibilite,computed_at,therapists(first_name,last_name,canton,slug,created_at)",
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
        score_previous: (r.score_previous ?? null) as number | null,
        last_recap_sent_at: (r.last_recap_sent_at ?? null) as string | null,
        created_at: (r.therapists?.created_at ?? null) as string | null,
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
    // Moyenne par spécialité principale (thérapeutes partageant la 1re spécialité)
    let specialtyAvg: { specialty: string | null; avg: number | null; sample: number } = { specialty: null, avg: null, sample: 0 };
    const mainSpec = (therRes.data?.specialties ?? [])[0] as string | undefined;
    if (mainSpec) {
      const { data: peers } = await sb
        .from("therapists")
        .select("id, therapist_health_scores(score_total)")
        .contains("specialties", [mainSpec]);
      const scores = ((peers ?? []) as any[])
        .map((p) => p.therapist_health_scores?.score_total)
        .filter((n: any) => typeof n === "number") as number[];
      if (scores.length) {
        specialtyAvg = {
          specialty: mainSpec,
          avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
          sample: scores.length,
        };
      } else {
        specialtyAvg = { specialty: mainSpec, avg: null, sample: 0 };
      }
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
      specialtyAvg,
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

// POINT 3a — suggestion d'article via la passerelle Lovable (in-app, réutilise
// l'accès gateway existant — pas d'edge function ni de secret séparé à poser).
export const regenerateArticleIdea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: t } = await sb.from("therapists").select("specialties,canton").eq("id", data.therapistId).maybeSingle();
    if (!t) throw new Error("Thérapeute introuvable.");

    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { generateText } = await import("ai");
    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const specs = (t.specialties ?? []).join(", ") || "bien-être holistique";
    const system = `Tu es l'assistant éditorial de Holiswiss, annuaire suisse de thérapeutes holistiques.
À partir des spécialités d'un praticien, propose UN seul sujet d'article pour la section « Voix d'experts ».
Contraintes : titre concret et cliquable en français, orienté patient suisse, 8 à 14 mots, angle utile
(bienfaits, idées reçues, remboursement, quand consulter). Respect LPMéd : éviter « soin/guérison/traitement/diagnostic ».
Réponds UNIQUEMENT par le titre, sans guillemets.`;
    const prompt = `Spécialités : ${specs}. Canton : ${t.canton ?? "Suisse"}. Propose UN titre d'article.`;

    let title = "";
    try {
      const r = await generateText({ model: provider("google/gemini-3-flash-preview"), system, prompt });
      title = (r.text ?? "").trim().replace(/^["'«»\s]+|["'«»\s]+$/g, "");
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("402")) throw new Error("Crédits IA épuisés.");
      if (msg.includes("429")) throw new Error("Limite de requêtes atteinte, réessayez plus tard.");
      throw new Error("Génération IA échouée.");
    }
    if (!title) throw new Error("L'IA n'a pas renvoyé de titre.");

    await sb.from("therapist_health_scores").update({ article_idea: title, article_idea_source: "llm" }).eq("therapist_id", data.therapistId);
    return { title };
  });

// POINT 3b — email d'invitation au thérapeute (score + top actions, cadrage positif).
// N'inclut JAMAIS la citabilité IA (admin-only).
export const sendProfileHealthInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: t } = await sb.from("therapists").select("first_name,email").eq("id", data.therapistId).maybeSingle();
    if (!t?.email) throw new Error("Ce thérapeute n'a pas d'adresse email.");
    const { data: score } = await sb.from("therapist_health_scores").select("score_total").eq("therapist_id", data.therapistId).maybeSingle();
    const { data: recos } = await sb
      .from("therapist_health_recommendations")
      .select("label,impact_points,severity")
      .eq("therapist_id", data.therapistId)
      .eq("status", "todo");
    const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const actions = ((recos ?? []) as any[])
      .sort((x, y) => (rank[x.severity] ?? 3) - (rank[y.severity] ?? 3) || y.impact_points - x.impact_points)
      .slice(0, 3)
      .map((r) => ({ label: r.label as string, impact_points: r.impact_points as number }));

    const { sendProfileHealthEmail } = await import("@/lib/profile-health-email.server");
    const res = await sendProfileHealthEmail({
      firstName: t.first_name ?? "",
      email: t.email,
      score: score?.score_total ?? 0,
      actions,
      sentBy: context.userId,
    });
    if (!res.sent) throw new Error("L'email n'a pas pu être envoyé (voir email_logs).");
    return { sent: true };
  });

// POINT 5 — envoie l'idée d'article à l'agent GEO (semer une suggestion). L'agent
// rédige au prochain run et dépose un brouillon `pending_validation` (jamais auto-publié).
export const queueSuggestedArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: t } = await sb.from("therapists").select("first_name,last_name,specialties").eq("id", data.therapistId).maybeSingle();
    const { data: score } = await sb.from("therapist_health_scores").select("article_idea").eq("therapist_id", data.therapistId).maybeSingle();
    const sujet = score?.article_idea as string | undefined;
    if (!sujet) throw new Error("Aucune idée d'article à envoyer. Générez-la d'abord.");
    const categorie = (t?.specialties?.[0] as string | undefined) ?? "bien-etre";
    const { error } = await sb.from("article_suggestions").insert({
      sujet,
      categorie,
      requete_geo: null,
      priorite: 1,
      source: "manual",
      status: "pending",
      notes: `Suggéré via agent Santé de Profil pour ${t?.first_name ?? ""} ${t?.last_name ?? ""}`.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// POINT 4 — déclenche à la demande la mesure de citabilité IA (edge function).
export const runCitabilityScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Configuration Supabase manquante.");
    const res = await fetch(`${url}/functions/v1/measure-ai-citability`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: "{}",
    });
    if (res.status === 404) {
      throw new Error("La fonction de mesure « measure-ai-citability » n'est pas encore déployée sur cette base.");
    }
    if (!res.ok) throw new Error(`Mesure de citabilité échouée (HTTP ${res.status}).`);
    const j = (await res.json()) as { processed?: number; reachable?: number };
    return { processed: j.processed ?? 0, reachable: j.reachable ?? 0 };
  });
