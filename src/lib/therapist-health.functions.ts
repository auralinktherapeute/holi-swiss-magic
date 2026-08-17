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
        .select("id,user_id,first_name,last_name,email,phone,address,city,canton,created_at,slug,specialties,languages,subscription_plan")
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
    // Le plan est porté par therapists.subscription_plan (la table
    // `subscriptions` n'existe pas en production).
    let plan = "free";
    if (therRes.data?.subscription_plan) {
      plan = therRes.data.subscription_plan as string;
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

    // AUDIT DE DIVERSITÉ — regarder ce qui a déjà été couvert pour ne pas répéter les
    // mêmes thèmes (le blog sur-produisait remboursement/assurance, ostéopathie,
    // acupuncture, naturopathie, massage). On donne cette réalité à l'IA en contexte.
    const { data: recent } = await sb
      .from("articles")
      .select("category,title_fr")
      .order("created_at", { ascending: false })
      .limit(60);
    const recentRows = (recent ?? []) as Array<{ category: string | null; title_fr: string | null }>;
    const catCounts = recentRows.reduce<Record<string, number>>((acc, r) => {
      const c = (r.category ?? "").trim();
      if (c) acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {});
    const saturated = Object.entries(catCounts)
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} (${n} articles)`);
    const recentTitles = recentRows.slice(0, 15).map((r) => r.title_fr).filter(Boolean) as string[];
    const coverage = saturated.length
      ? `Spécialités DÉJÀ SATURÉES sur le blog (à éviter sauf si absentes des titres récents) : ${saturated.join(", ")}.`
      : "Aucune spécialité encore saturée.";
    const titlesBlock = recentTitles.length
      ? `Titres RÉCENTS — n'en répète ni le thème ni l'angle :\n- ${recentTitles.join("\n- ")}`
      : "";

    const system = `Tu es l'assistant éditorial de Holiswiss, annuaire suisse de thérapeutes holistiques.
Propose UN seul sujet d'article pour la section « Voix d'experts », en VARIANT délibérément les thèmes.
RÈGLE DE DIVERSITÉ (prioritaire sur tout le reste) :
- N'utilise PAS les angles saturés du blog : remboursement/assurance/LAMal/ASCA-RME, douleurs
  ostéopathiques (cervicales, sciatique, tendinite), acupuncture générique, naturopathie féminine,
  massage — SAUF s'ils sont clairement absents des titres récents ci-dessous.
- Choisis un ANGLE frais : prévention, saison, sommeil, stress au travail, digestion, énergie,
  émotions, transitions de vie, sport, écrans, respiration, alimentation.
- Si le praticien a plusieurs spécialités, mets en avant la MOINS couverte sur le blog.
Contraintes : titre concret et cliquable en français, orienté patient suisse, 8 à 14 mots.
Respect LPMéd : éviter « soin/guérison/traitement/diagnostic ». Réponds UNIQUEMENT par le titre, sans guillemets.`;
    const prompt = `Spécialités du praticien : ${specs}. Canton : ${t.canton ?? "Suisse"}.
${coverage}
${titlesBlock}
Propose UN titre d'article qui APPORTE DE LA VARIÉTÉ par rapport à tout ce qui précède.`;

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

// Envoi du RÉCAPITULATIF COMPLET (score + détail par catégorie + points forts + toutes actions).
// Marque last_recap_sent_at pour éviter les doublons visibles côté admin.
export const sendProfileHealthRecap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: t } = await sb.from("therapists").select("first_name,email").eq("id", data.therapistId).maybeSingle();
    if (!t?.email) throw new Error("Ce thérapeute n'a pas d'adresse email.");
    const { data: score } = await sb
      .from("therapist_health_scores")
      .select("score_total,score_completude,score_contenu,score_activite,score_visibilite,strengths")
      .eq("therapist_id", data.therapistId)
      .maybeSingle();
    const { data: recos } = await sb
      .from("therapist_health_recommendations")
      .select("label,impact_points,severity,category,status")
      .eq("therapist_id", data.therapistId)
      .eq("status", "todo");
    const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const actions = ((recos ?? []) as any[])
      .sort((x, y) => (rank[x.severity] ?? 3) - (rank[y.severity] ?? 3) || y.impact_points - x.impact_points)
      .map((r) => ({ label: r.label as string, impact_points: r.impact_points as number, category: r.category as string }));

    const { sendProfileHealthRecap: sendRecap } = await import("@/lib/profile-health-recap-email.server");
    const res = await sendRecap({
      firstName: t.first_name ?? "",
      email: t.email,
      score: score?.score_total ?? 0,
      breakdown: {
        completude: score?.score_completude ?? 0,
        contenu: score?.score_contenu ?? 0,
        activite: score?.score_activite ?? 0,
        visibilite: score?.score_visibilite ?? 0,
      },
      strengths: ((score?.strengths ?? []) as any[]).map((x) => ({ label: x.label as string })),
      actions,
      sentBy: context.userId,
    });
    if (!res.sent) throw new Error("L'email n'a pas pu être envoyé (voir email_logs).");
    await sb
      .from("therapist_health_scores")
      .update({ last_recap_sent_at: new Date().toISOString() })
      .eq("therapist_id", data.therapistId);
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

// POINT 4 — calcule la citabilité IA de chaque profil (admin-only).
// Heuristique in-app basée sur les signaux existants (RPC therapist_health_signals) :
// un profil est « citable » par une IA/LLM si sa page publique est riche, structurée,
// signée et régulièrement mise à jour. Aucune edge function requise.
//
// Barème /100 :
//   - has_photo .......... 10
//   - has_meta (SEO) ..... 15
//   - has_web (site) .....  5
//   - verified ...........  8
//   - bio_len ≥ 600 ...... 15  (≥300 = 8)
//   - n_specialties ≥ 3 ..  6  (≥1 = 3)
//   - n_languages  ≥ 2 ...  4  (≥1 = 2)
//   - has_geo ............  6
//   - has_price ..........  4
//   - n_articles  ≥ 3 .... 12  (≥1 = 6)
//   - n_reviews   ≥ 5 .... 10  (≥1 = 4)
//   - slug défini ........  5
export const runCitabilityScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: ths, error: thErr } = await sb
      .from("therapists")
      .select("id, slug, status, services")
      .eq("status", "active");
    if (thErr) throw new Error(`Lecture thérapeutes impossible : ${thErr.message}`);
    const list = (ths ?? []) as Array<{ id: string; slug: string | null; services: any }>;

    let processed = 0;
    let reachable = 0;
    const now = new Date().toISOString();

    for (const t of list) {
      const { data: sigRows, error: sigErr } = await sb.rpc("therapist_health_signals", { _id: t.id });
      if (sigErr || !sigRows || sigRows.length === 0) continue;
      const s = sigRows[0] as any;

      let score = 0;
      const detail: Record<string, number> = {};
      const add = (k: string, v: number) => { detail[k] = v; score += v; };

      add("has_photo", s.has_photo ? 10 : 0);
      add("has_meta", s.has_meta ? 15 : 0);
      add("has_web", s.has_web ? 5 : 0);
      add("verified", s.verified ? 8 : 0);
      add("bio_len", (s.bio_len ?? 0) >= 600 ? 15 : (s.bio_len ?? 0) >= 300 ? 8 : 0);
      add("specialties", (s.n_specialties ?? 0) >= 3 ? 6 : (s.n_specialties ?? 0) >= 1 ? 3 : 0);
      add("languages", (s.n_languages ?? 0) >= 2 ? 4 : (s.n_languages ?? 0) >= 1 ? 2 : 0);
      add("has_geo", s.has_geo ? 6 : 0);
      add("has_price", s.has_price ? 4 : 0);
      add("articles", (s.n_articles ?? 0) >= 3 ? 12 : (s.n_articles ?? 0) >= 1 ? 6 : 0);
      add("reviews", (s.n_reviews ?? 0) >= 5 ? 10 : (s.n_reviews ?? 0) >= 1 ? 4 : 0);
      add("has_slug", s.slug ? 5 : 0);

      // Balisage structuré (JSON-LD) — Person + Service[] + BreadcrumbList
      // + AggregateRating/Review sont émis automatiquement dès qu'un profil
      // est actif. On récompense la richesse du @graph (services décrits,
      // avis rattachés) qui augmente concrètement la citabilité IA.
      const services = Array.isArray(t.services) ? t.services : [];
      const nServices = services.filter(
        (x: any) => x && x.visible !== false && (x.name ?? "").trim().length > 0,
      ).length;
      const hasAggregateRating = (s.n_reviews ?? 0) >= 1;
      let sdScore = 0;
      if (s.slug) sdScore += 4; // Person + BreadcrumbList émis
      if (nServices >= 3) sdScore += 6;
      else if (nServices >= 1) sdScore += 3;
      if (hasAggregateRating) sdScore += 3;
      if (s.has_meta) sdScore += 2;
      add("structured_data", sdScore);

      score = Math.max(0, Math.min(100, score));
      if (score >= 40) reachable += 1;

      // UPDATE seul : la ligne est créée par le scan « Santé » (compute_therapist_health).
      const { error: upErr, count } = await sb
        .from("therapist_health_scores")
        .update(
          { ai_citability: score, ai_citability_detail: detail, ai_citability_at: now },
          { count: "exact" },
        )
        .eq("therapist_id", t.id);
      if (!upErr && (count ?? 0) > 0) processed += 1;
    }

    return { processed, reachable };
  });

/**
 * Contrôles automatiques de la vitrine publique (admin).
 * Réutilise le module pur `showcase-audit` : deux totaux (visibilité SEO
 * et conversion) calculés à partir des données réelles, jamais estimées.
 */
export const auditTherapistShowcase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadShowcaseAudit } = await import("@/lib/showcase-audit.server");
    const { resolveScoringAccess } = await import("@/lib/scoring-access.server");
    const sb = supabaseAdmin as any;
    const [audit, access] = await Promise.all([
      loadShowcaseAudit(sb, data.therapistId),
      resolveScoringAccess(sb, data.therapistId),
    ]);
    return { ...audit, level: "admin" as const, access };
  });

/**
 * Audit de SA PROPRE vitrine, pour le tableau de bord thérapeute.
 * Même moteur de scoring que l'admin ; la fiche est résolue à partir de
 * l'utilisateur authentifié — aucun identifiant n'est accepté en entrée.
 * Niveau 1 (base) : score global simplifié + essentiels. Niveau 2 (avancé) :
 * détail complet des contrôles, réservé aux thérapeutes éligibles.
 */
export const auditMyShowcase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: me } = await sb
      .from("therapists")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!me?.id) return null;
    const { loadShowcaseAudit } = await import("@/lib/showcase-audit.server");
    const { basicSummary } = await import("@/lib/showcase-audit");
    const { resolveScoringAccess } = await import("@/lib/scoring-access.server");
    const [audit, access] = await Promise.all([
      loadShowcaseAudit(sb, me.id as string),
      resolveScoringAccess(sb, me.id as string),
    ]);
    const basic = basicSummary(audit.checks);
    return access.advanced
      ? { slug: audit.slug, access, basic, checks: audit.checks, totals: audit.totals }
      : { slug: audit.slug, access, basic, checks: null, totals: null };
  });

/** Éligibilité + accès accordé (admin). */
export const getTherapistScoringAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveScoringAccess } = await import("@/lib/scoring-access.server");
    return resolveScoringAccess(supabaseAdmin as any, data.therapistId);
  });

/** Accorder / retirer l'accès avancé (admin). */
export const setTherapistScoringAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      therapistId: z.string().uuid(),
      enabled: z.boolean(),
      source: z
        .enum(["founding_70", "elite_pro", "commercial_offer", "manual_grant", "admin_manual", "offer_accepted"])
        .default("manual_grant"),
      startsAt: z.string().datetime().nullable().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
      note: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveScoringAccess } = await import("@/lib/scoring-access.server");
    const sb = supabaseAdmin as any;
    const startsAt = data.startsAt ?? new Date().toISOString();
    const { error } = await sb.from("therapist_advanced_scoring_access").upsert(
      {
        therapist_id: data.therapistId,
        enabled: data.enabled,
        source: data.source,
        note: data.note ?? null,
        starts_at: startsAt,
        expires_at: data.expiresAt ?? null,
        granted_by: context.userId,
        granted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "therapist_id" },
    );
    if (error) throw new Error(error.message);
    await sb.from("therapist_scoring_access_events").insert({
      therapist_id: data.therapistId,
      action: data.enabled ? "granted" : "revoked",
      source: data.source,
      starts_at: startsAt,
      expires_at: data.expiresAt ?? null,
      note: data.note ?? null,
      actor: context.userId,
    });
    return resolveScoringAccess(sb, data.therapistId);
  });

/** Historique des modifications d'accès avancé (admin). */
export const listScoringAccessEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ therapistId: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("therapist_scoring_access_events")
      .select("id,action,source,starts_at,expires_at,note,created_at")
      .eq("therapist_id", data.therapistId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ── Places fondateur (70 premiers thérapeutes) ───────────────────────────────

/** Vue d'ensemble des places fondateur + historique (admin). */
export const listFounderSeats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const [{ data: seats }, { data: events }, { data: setting }] = await Promise.all([
      sb
        .from("founder_seats")
        .select("seat_number,therapist_id,source,status,granted_at,revoked_at,note")
        .order("seat_number", { ascending: true }),
      sb
        .from("founder_seat_events")
        .select("id,therapist_id,seat_number,action,source,note,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      sb.from("app_settings").select("value").eq("key", "founder_seat_number_display").maybeSingle(),
    ]);
    const ids = Array.from(
      new Set([...(seats ?? []), ...(events ?? [])].map((r: any) => r.therapist_id)),
    );
    const { data: people } = ids.length
      ? await sb.from("therapists").select("id,first_name,last_name,slug,status,subscription_plan").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((people ?? []).map((p: any) => [p.id, p]));
    const decorate = (r: any) => ({ ...r, therapist: byId.get(r.therapist_id) ?? null });
    const used = (seats ?? []).length;
    return {
      total: 70,
      used,
      remaining: Math.max(0, 70 - used),
      active: (seats ?? []).filter((s: any) => s.status === "active").length,
      seats: (seats ?? []).map(decorate),
      events: (events ?? []).map(decorate),
      showSeatNumber: setting?.value === true || setting?.value === "true" || setting == null,
    };
  });

/** Attribuer / retirer une place fondateur (admin). */
export const setFounderSeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      therapistId: z.string().uuid(),
      enabled: z.boolean(),
      source: z.enum(["admin_manual", "commercial_offer", "offer_accepted"]).default("admin_manual"),
      note: z.string().max(500).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    if (data.enabled) {
      const { data: seat, error } = await sb.rpc("claim_founder_seat", {
        _therapist_id: data.therapistId,
        _source: data.source,
        _actor: context.userId,
        _note: data.note ?? null,
      });
      if (error) throw new Error(error.message);
      if (seat == null) throw new Error("Les 70 places fondateur sont toutes attribuées.");
      return { ok: true, seatNumber: seat as number };
    }
    const { error } = await sb.rpc("revoke_founder_seat", {
      _therapist_id: data.therapistId,
      _actor: context.userId,
      _note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, seatNumber: null };
  });

/** Afficher ou masquer le numéro de place côté thérapeute (admin). */
export const setFounderSeatDisplay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ show: z.boolean() }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("app_settings")
      .upsert({ key: "founder_seat_number_display", value: data.show, updated_at: new Date().toISOString() });
    if (error) throw new Error("Impossible de modifier le réglage.");
    return { ok: true, show: data.show };
  });

/** Rapport « Score de visibilité » du thérapeute connecté (lecture). */
export const getMyShowcaseReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: me } = await sb.from("therapists").select("id").eq("user_id", context.userId).maybeSingle();
    if (!me?.id) return null;
    const { buildShowcaseReport } = await import("@/lib/showcase-audit.server");
    return buildShowcaseReport(sb, me.id as string, false);
  });

/** Relance l'analyse et enregistre un nouvel instantané. */
export const runMyShowcaseAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;
    const { data: me } = await sb.from("therapists").select("id").eq("user_id", context.userId).maybeSingle();
    if (!me?.id) return null;
    const { buildShowcaseReport } = await import("@/lib/showcase-audit.server");
    return buildShowcaseReport(sb, me.id as string, true);
  });
