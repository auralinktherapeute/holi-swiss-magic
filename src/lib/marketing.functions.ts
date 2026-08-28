import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const PROPOSAL_COLUMNS =
  "id,proposal_date,network,pillar,angle,format,caption,caption_en,caption_de,caption_it,hashtags,hashtags_en,hashtags_de,hashtags_it,visual_brief,visual_prompt,suggested_time,lang,status,correction_note,validated_at,published_at,external_ref,created_at,carousel_page_count,carousel_presentation,carousel_generation_version";

/** Liste des propositions marketing (admin only), plus récentes d'abord. */
export const listMarketingProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Table hors types générés (créée hors migration Lovable jusqu'à sync) → any.
    const { data, error } = await (supabaseAdmin as any)
      .from("marketing_proposals")
      .select(PROPOSAL_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Impossible de charger les propositions marketing.");
    return { rows: data ?? [] };
  });

/**
 * Change le statut d'une proposition (admin only). C'est ICI, et uniquement ici,
 * que la validation humaine est enregistrée. La publication réelle (Postiz) ne
 * pourra se faire que sur une proposition passée en 'valide'.
 */
export const setMarketingProposalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["valide", "correction_demandee", "refuse", "en_attente_validation"]),
        note: z.string().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      status: data.status,
      updated_at: new Date().toISOString(),
    };
    if (data.status === "valide") patch.validated_at = new Date().toISOString();
    if (data.status === "correction_demandee") patch.correction_note = data.note ?? null;
    const { error } = await (supabaseAdmin as any)
      .from("marketing_proposals")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error("Impossible de mettre à jour la proposition.");
    return { ok: true, status: data.status };
  });

/* ------------------------------------------------------- sujets soumis ---- */

const TOPIC_COLUMNS =
  "id,subject,target_date,network,format,note,status,reject_reason,submitted_by,processed_at,created_at";

/**
 * Sujets soumis à la main (admin only), les plus proches d'abord.
 * Un sujet est produit EN SUPPLÉMENT de la publication programmée du jour,
 * jamais à sa place — voir `.agents/product-marketing.md` § 12.
 */
export const listMarketingTopics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("marketing_topics")
      .select(TOPIC_COLUMNS)
      .order("status", { ascending: true })
      .order("target_date", { ascending: true })
      .limit(50);
    if (error) throw new Error("Impossible de charger les sujets soumis.");
    return { rows: data ?? [] };
  });

/**
 * Soumet un sujet pour une date donnée (par défaut demain).
 * Ne produit AUCUN contenu : c'est une mise en file. Le prochain cycle
 * `/marketing-daily` le traitera, avec le même filtre qualité que les autres.
 */
export const createMarketingTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        subject: z.string().trim().min(10, "Décrivez le sujet en une phrase au moins.").max(500),
        target_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ.")
          .optional(),
        network: z.enum(["instagram", "linkedin", "tiktok"]).optional(),
        format: z.enum(["carrousel", "reel", "post", "story"]).optional(),
        note: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Défaut : demain. Calculé côté serveur pour ne pas dépendre du fuseau du navigateur.
    const target =
      data.target_date ??
      new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const { data: row, error } = await (supabaseAdmin as any)
      .from("marketing_topics")
      .insert({
        subject: data.subject,
        target_date: target,
        network: data.network ?? null,
        format: data.format ?? null,
        note: data.note ?? null,
        status: "en_attente",
        submitted_by: "admin",
      })
      .select("id,target_date")
      .single();
    if (error || !row) throw new Error("Impossible d'enregistrer le sujet.");
    return { id: row.id as string, target_date: row.target_date as string };
  });

/**
 * Modifie un sujet encore en file (admin only).
 * Un sujet déjà traité n'est plus modifiable : la proposition qui en découle
 * existe, la rééditer créerait une incohérence entre les deux.
 */
export const updateMarketingTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        subject: z.string().trim().min(10, "Décrivez le sujet en une phrase au moins.").max(500),
        target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ."),
        network: z.enum(["instagram", "linkedin", "tiktok"]).nullable().optional(),
        format: z.enum(["carrousel", "reel", "post", "story"]).nullable().optional(),
        note: z.string().trim().max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("marketing_topics")
      .update({
        subject: data.subject,
        target_date: data.target_date,
        network: data.network ?? null,
        format: data.format ?? null,
        note: data.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "en_attente") // un sujet traité n'est plus modifiable
      .select("id");
    if (error) throw new Error("Impossible de modifier ce sujet.");
    if (!rows?.length) throw new Error("Ce sujet a déjà été traité — il n'est plus modifiable.");
    return { ok: true };
  });

/** Abandonne un sujet encore en file (admin only). */
export const abandonMarketingTopic = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("marketing_topics")
      .update({ status: "abandonne", updated_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "en_attente"); // on n'abandonne jamais un sujet déjà traité
    if (error) throw new Error("Impossible d'abandonner ce sujet.");
    return { ok: true };
  });

/**
 * Crée une proposition (admin only) — utile pour un test manuel depuis l'admin.
 * En production, l'équipe d'agents insère via la clé service (voir MARKETING.md).
 */
export const createMarketingProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        network: z.enum(["instagram", "linkedin", "tiktok"]),
        pillar: z.string().max(40).optional(),
        angle: z.string().max(500).optional(),
        format: z.string().max(120).optional(),
        caption: z.string().min(1).max(5000),
        caption_en: z.string().max(5000).optional(),
        caption_de: z.string().max(5000).optional(),
        caption_it: z.string().max(5000).optional(),
        hashtags: z.string().max(1000).optional(),
        hashtags_en: z.string().max(1000).optional(),
        hashtags_de: z.string().max(1000).optional(),
        hashtags_it: z.string().max(1000).optional(),
        visual_brief: z.string().max(5000).optional(),
        visual_prompt: z.string().max(2000).optional(),
        suggested_time: z.string().max(20).optional(),
        lang: z.string().max(10).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("marketing_proposals")
      .insert({ ...data, status: "en_attente_validation" })
      .select("id")
      .single();
    if (error || !row) throw new Error("Impossible de créer la proposition.");
    return { id: row.id as string };
  });
