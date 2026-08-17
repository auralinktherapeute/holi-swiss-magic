import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import { HOLISWISS_FEATURES, findFeature } from "@/lib/holiswiss-features.shared";
import { auditIssueLinks, LINK_AUDIT_COLUMNS } from "@/lib/newsletter-links.server";
import { buildSuggestions } from "@/lib/newsletter-suggestions.server";

/* eslint-disable @typescript-eslint/no-explicit-any -- tables newsletter absentes des types générés. */
type AnyClient = { from: (table: string) => any };

const idSchema = z.object({ id: z.string().uuid() });

/** Contrôle des liens internes d'une édition (admin uniquement). */
export const checkNewsletterLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as AnyClient;
    const { data: row } = await client
      .from("newsletter_issues")
      .select(LINK_AUDIT_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Newsletter introuvable.");
    return auditIssueLinks(client, row);
  });

/**
 * Contexte transmis à l'agent IA : uniquement des informations éditoriales et
 * la description officielle de la fonctionnalité. Aucune donnée client, CRM,
 * financière, de santé ni de rendez-vous n'y figure.
 */
export const getNewsletterAiContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as unknown as AnyClient)
      .from("newsletter_issues")
      .select(
        "title,objective,audience,pillar,tone,cta,lang,feature_key,target_route,action_label,action_difficulty,action_minutes,segment_key",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Newsletter introuvable.");
    const feature = findFeature(row.feature_key);
    return {
      context: {
        objectif: row.objective ?? null,
        public_cible: row.audience ?? null,
        pilier: row.pillar ?? null,
        ton: row.tone ?? null,
        langue: row.lang ?? "fr",
        appel_a_action: row.cta ?? null,
        action_recommandee: row.action_label ?? null,
        difficulte: row.action_difficulty ?? null,
        temps_estime_minutes: row.action_minutes ?? null,
        fonctionnalite: feature
          ? {
              nom: feature.label,
              description_officielle: feature.description,
              limites: feature.limits,
              route_reelle: feature.status === "disponible" ? feature.route : null,
              statut: feature.status,
            }
          : null,
        regles_editoriales: [
          "S'adresser aux thérapeutes, jamais à leurs clients.",
          "Utiliser uniquement la description officielle de la fonctionnalité.",
          "Ne jamais inventer de lien, de chiffre ni de promesse de résultats.",
          "Ne jamais mentionner de données individuelles (score, clients, finances, santé).",
        ],
      },
    };
  });

/** Contenus liables : articles experts publiés, articles Holiswiss validés, pages ressources. */
export const listLinkableContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as AnyClient;
    const [expert, blog, resources] = await Promise.all([
      client
        .from("therapist_articles")
        .select("id,titre,slug,date_publication")
        .eq("statut", "publie")
        .order("date_publication", { ascending: false })
        .limit(100),
      client
        .from("articles")
        .select("id,slug,title_fr,published_at")
        .eq("status", "validated")
        .order("published_at", { ascending: false })
        .limit(100),
      client
        .from("newsletter_issues")
        .select("id,slug,resource_title,lang,published_at")
        .not("published_at", "is", null)
        .neq("status", "archivee")
        .order("published_at", { ascending: false })
        .limit(100),
    ]);
    return {
      expert: (expert.data ?? []).map((a: any) => ({
        id: a.id,
        title: a.titre,
        slug: a.slug,
        route: `/fr/paroles/${a.slug}`,
      })),
      blog: (blog.data ?? []).map((a: any) => ({
        id: a.id,
        title: a.title_fr,
        slug: a.slug,
        route: `/fr/blog/${a.slug}`,
      })),
      resources: (resources.data ?? []).map((r: any) => ({
        id: r.id,
        title: r.resource_title,
        slug: r.slug,
        route: `/${r.lang || "fr"}/lettre/${r.slug}`,
      })),
    };
  });

/** Catalogue des fonctionnalités (exposé aussi côté serveur pour cohérence). */
export const listHoliswissFeatures = createServerFn({ method: "GET" }).handler(async () => ({
  features: HOLISWISS_FEATURES,
}));

/* ------------------------------ Suggestions ------------------------------ */

const SUGGESTION_COLUMNS =
  "id,subject,audience,pillar,feature_key,objective,rationale,priority,source,status,issue_id,created_at";

export const listNewsletterSuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as unknown as AnyClient)
      .from("newsletter_suggestions")
      .select(SUGGESTION_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(200);
    return { rows: rows ?? [] };
  });

const suggestionSchema = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().trim().min(3).max(200),
  audience: z.string().trim().max(300).optional().nullable(),
  pillar: z.string().trim().max(200).optional().nullable(),
  feature_key: z.string().trim().max(60).optional().nullable(),
  objective: z.string().trim().max(2000).optional().nullable(),
  rationale: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(["basse", "moyenne", "haute"]).default("moyenne"),
});

export const saveNewsletterSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => suggestionSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as AnyClient;
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    const { id, ...patch } = data;
    if (id) {
      const { error } = await client
        .from("newsletter_suggestions")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error("Impossible d'enregistrer la suggestion.");
      return { id };
    }
    const { data: row, error } = await client
      .from("newsletter_suggestions")
      .insert({ ...patch, source: "manuelle", created_by: context.userId, created_by_email: email })
      .select("id")
      .single();
    if (error || !row) throw new Error("Impossible d'enregistrer la suggestion.");
    return { id: row.id as string };
  });

export const setNewsletterSuggestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), status: z.enum(["ouverte", "acceptee", "rejetee"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as AnyClient)
      .from("newsletter_suggestions")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error("Impossible de mettre à jour la suggestion.");
    return { ok: true };
  });

export const deleteNewsletterSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as unknown as AnyClient)
      .from("newsletter_suggestions")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Suppression impossible.");
    return { ok: true };
  });

/** Recalcule les suggestions automatiques (agrégats uniquement, aucune donnée individuelle). */
export const refreshNewsletterSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as AnyClient;
    const suggestions = await buildSuggestions(client);

    const { data: existing } = await client
      .from("newsletter_suggestions")
      .select("subject,status")
      .limit(500);
    const known = new Set(((existing ?? []) as { subject: string }[]).map((r) => r.subject));

    const rows = suggestions.filter((s) => !known.has(s.subject));
    if (rows.length) {
      await client
        .from("newsletter_suggestions")
        .insert(rows.map((s) => ({ ...s, source: "automatique", status: "ouverte" })));
    }
    return { added: rows.length };
  });

/** Crée un brief à partir d'une suggestion — jamais d'envoi automatique. */
export const createBriefFromSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => idSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as AnyClient;
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;

    const { data: s } = await client
      .from("newsletter_suggestions")
      .select(SUGGESTION_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (!s) throw new Error("Suggestion introuvable.");
    if (s.issue_id) return { id: s.issue_id as string };

    const feature = findFeature(s.feature_key);
    const { data: issue, error } = await client
      .from("newsletter_issues")
      .insert({
        title: s.subject,
        objective: s.objective,
        audience: s.audience,
        pillar: s.pillar,
        feature_key: s.feature_key,
        feature_highlight: feature?.label ?? null,
        target_route: feature?.status === "disponible" ? feature.route : null,
        cta: feature?.ctaLabel ?? null,
        connection_priority: s.priority,
        internal_notes: s.rationale,
        status: "brouillon",
        lang: "fr",
        created_by: context.userId,
        created_by_email: email,
      })
      .select("id")
      .single();
    if (error || !issue) throw new Error("Impossible de créer le brief.");

    await client
      .from("newsletter_suggestions")
      .update({ status: "acceptee", issue_id: issue.id, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    await client.from("newsletter_revisions").insert({
      issue_id: issue.id,
      action: "Brief créé depuis une suggestion",
      status: "brouillon",
      actor_id: context.userId,
      actor_email: email,
    });
    return { id: issue.id as string };
  });
