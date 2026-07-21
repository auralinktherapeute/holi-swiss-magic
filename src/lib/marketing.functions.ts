import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const PROPOSAL_COLUMNS =
  "id,proposal_date,network,pillar,angle,format,caption,hashtags,visual_brief,visual_prompt,suggested_time,lang,status,correction_note,validated_at,published_at,external_ref,created_at";

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
        hashtags: z.string().max(1000).optional(),
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
