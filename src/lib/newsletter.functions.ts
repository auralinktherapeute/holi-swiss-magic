import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import { NEWSLETTER_STATUSES, NEWSLETTER_LANGS } from "@/lib/newsletter.shared";

/* eslint-disable @typescript-eslint/no-explicit-any -- `newsletter_issues` n'est pas encore dans les types générés Supabase. */
type SupabaseAnyClient = {
  from: (table: string) => any;
};

const BRIEF_COLUMNS =
  "id,title,problem,objective,audience,pillar,tone,feature_highlight,cta,lang,target_date,internal_notes,status,created_at,updated_at,created_by_email,slug,published_at";

const FULL_COLUMNS = `${BRIEF_COLUMNS},email_subject,email_preheader,email_intro,email_body,email_button_label,email_button_url,email_footer,resource_title,resource_intro,resource_body,resource_sections,resource_example,resource_checklist,resource_takeaway,resource_cta,seo_title,meta_description,share_image_url,canonical_url,qc_checklist`;

/** Colonnes strictement publiques : jamais de notes internes ni de brief. */
const PUBLIC_COLUMNS =
  "id,slug,lang,resource_title,resource_intro,resource_body,resource_sections,resource_example,resource_checklist,resource_takeaway,resource_cta,seo_title,meta_description,share_image_url,canonical_url,published_at,title";

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const briefSchema = z.object({
  title: z.string().trim().min(3, "Donnez un titre ou une idée.").max(200),
  problem: nullableText(2000),
  objective: nullableText(2000),
  audience: nullableText(300),
  pillar: nullableText(200),
  tone: nullableText(200),
  feature_highlight: nullableText(300),
  cta: nullableText(300),
  lang: z.enum(NEWSLETTER_LANGS).default("fr"),
  target_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  internal_notes: nullableText(4000),
  status: z.enum(NEWSLETTER_STATUSES).default("brouillon"),
});

const contentSchema = z.object({
  id: z.string().uuid(),
  email_subject: nullableText(200),
  email_preheader: nullableText(200),
  email_intro: nullableText(3000),
  email_body: nullableText(20000),
  email_button_label: nullableText(80),
  email_button_url: nullableText(500),
  email_footer: nullableText(2000),
  resource_title: nullableText(200),
  resource_intro: nullableText(3000),
  resource_body: nullableText(40000),
  resource_sections: nullableText(40000),
  resource_example: nullableText(8000),
  resource_checklist: nullableText(8000),
  resource_takeaway: nullableText(4000),
  resource_cta: nullableText(500),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "Slug invalide : lettres minuscules, chiffres et tirets.")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  seo_title: nullableText(200),
  meta_description: nullableText(300),
  share_image_url: nullableText(500),
  canonical_url: nullableText(500),
  qc_checklist: z.record(z.string(), z.boolean()).default({}),
});

function actorEmail(context: { claims?: unknown }): string | null {
  const claims = context.claims as { email?: string } | undefined;
  return claims?.email ?? null;
}

async function logRevision(args: {
  issueId: string;
  action: string;
  status?: string | null;
  comment?: string | null;
  actorId: string;
  actorEmail: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as SupabaseAnyClient).from("newsletter_revisions").insert({
    issue_id: args.issueId,
    action: args.action,
    status: args.status ?? null,
    comment: args.comment ?? null,
    actor_id: args.actorId,
    actor_email: args.actorEmail,
  });
}

/** Liste des newsletters (admin uniquement). */
export const listNewsletterIssues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .select(BRIEF_COLUMNS)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error("Impossible de charger les newsletters.");
    return { rows: data ?? [] };
  });

/** Une newsletter complète (admin uniquement). */
export const getNewsletterIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .select(FULL_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error("Impossible de charger la newsletter.");
    if (!row) throw new Error("Newsletter introuvable.");
    return { issue: row };
  });

/** Historique éditorial (admin uniquement). */
export const listNewsletterRevisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_revisions")
      .select("id,action,status,comment,actor_email,created_at")
      .eq("issue_id", data.id)
      .order("created_at", { ascending: false })
      .limit(100);
    return { rows: rows ?? [] };
  });

/** Crée une newsletter à partir du brief éditorial (admin uniquement). */
export const createNewsletterIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => briefSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = actorEmail(context);
    const { data: row, error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .insert({ ...data, created_by: context.userId, created_by_email: email })
      .select("id")
      .single();
    if (error || !row) throw new Error("Impossible d'enregistrer la newsletter.");
    await logRevision({
      issueId: row.id as string,
      action: "Création du brief",
      status: data.status,
      actorId: context.userId,
      actorEmail: email,
    });
    return { id: row.id as string };
  });

/** Met à jour le brief d'une newsletter existante (admin uniquement). */
export const updateNewsletterIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => briefSchema.extend({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw new Error("Impossible de mettre à jour la newsletter.");
    await logRevision({
      issueId: id,
      action: "Brief mis à jour",
      status: patch.status,
      actorId: context.userId,
      actorEmail: actorEmail(context),
    });
    return { ok: true };
  });

/** Met à jour le contenu (email, page ressource, SEO, contrôle qualité). */
export const updateNewsletterContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => contentSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { id, ...patch } = data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: current } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    if (current?.status === "envoyee" || current?.status === "archivee") {
      throw new Error("Cette newsletter est verrouillée (envoyée ou archivée).");
    }

    const { error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error("Ce slug est déjà utilisé par une autre newsletter.");
      }
      throw new Error("Impossible d'enregistrer le contenu.");
    }

    await logRevision({
      issueId: id,
      action: "Contenu enregistré",
      status: current?.status ?? null,
      actorId: context.userId,
      actorEmail: actorEmail(context),
    });
    return { ok: true };
  });

/** Change le statut (validation humaine explicite) et journalise l'action. */
export const setNewsletterIssueStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(NEWSLETTER_STATUSES),
        comment: nullableText(1000),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .update({ status: data.status, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error("Impossible de changer le statut.");
    await logRevision({
      issueId: data.id,
      action: `Statut → ${data.status}`,
      status: data.status,
      comment: data.comment,
      actorId: context.userId,
      actorEmail: actorEmail(context),
    });
    return { ok: true };
  });

/** Publie ou dépublie la page ressource publique. */
export const setNewsletterResourcePublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.published) {
      const { data: row } = await (supabaseAdmin as SupabaseAnyClient)
        .from("newsletter_issues")
        .select("slug,resource_title,resource_body")
        .eq("id", data.id)
        .maybeSingle();
      if (!row?.slug) throw new Error("Renseignez un slug avant de publier la page ressource.");
      if (!row?.resource_title || !row?.resource_body) {
        throw new Error("Le titre et le contenu de la page ressource sont requis.");
      }
    }

    const { error } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .update({
        published_at: data.published ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error("Impossible de modifier la publication.");

    await logRevision({
      issueId: data.id,
      action: data.published ? "Page ressource publiée" : "Page ressource dépubliée",
      actorId: context.userId,
      actorEmail: actorEmail(context),
    });
    return { ok: true };
  });

/**
 * Page ressource publique : lecture anonyme, uniquement si publiée.
 * Projection explicite — les notes internes et le brief ne sortent jamais.
 */
export const getPublishedNewsletterBySlug = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ slug: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as SupabaseAnyClient)
      .from("newsletter_issues")
      .select(PUBLIC_COLUMNS)
      .eq("slug", data.slug)
      .not("published_at", "is", null)
      .neq("status", "archivee")
      .maybeSingle();
    return { issue: row ?? null };
  });
