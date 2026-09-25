import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

async function ownRow(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { TRANSLATION_SELECT } = await import("@/lib/profile-translation.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("therapists")
    .select(TRANSLATION_SELECT)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Lecture du profil impossible.");
  if (!data) throw new Error("Profil introuvable.");
  return data;
}

/** Traductions du praticien connecté + contenu original (pour l'écran côte à côte). */
export const getMyProfileTranslations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const row = await ownRow(context.userId);
    const { sourceHash } = await import("@/lib/profile-translations");
    return { row, currentHash: sourceHash(row) };
  });

/** (Re)traduit le profil du praticien connecté. Les traductions relues et à jour sont conservées. */
export const translateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const row = await ownRow(context.userId);
    const { translateTherapistRow } = await import("@/lib/profile-translation.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tr = await translateTherapistRow(row);
    const { error } = await (supabaseAdmin as any).from("therapists").update({ profile_translations: tr }).eq("id", row.id);
    if (error) throw new Error("Enregistrement des traductions impossible.");
    return { ok: true };
  });

const langField = z.object({
  title: z.string().max(300).nullable(),
  short_bio: z.string().max(2000).nullable(),
  bio: z.string().max(20000).nullable(),
  specialties: z.array(z.string().max(200)).max(60).nullable(),
  services: z.record(z.string(), z.object({ name: z.string().max(300), description: z.string().max(4000) })).nullable(),
});

/** Le praticien corrige/valide une traduction : statut « relue ». */
export const saveMyProfileTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lang: z.enum(["fr", "de", "it", "en"]), fields: langField }).parse(d))
  .handler(async ({ data, context }) => {
    const row = await ownRow(context.userId);
    const { sourceHash } = await import("@/lib/profile-translations");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tr = (row.profile_translations ?? {}) as any;
    if ((tr.source_lang ?? "fr") === data.lang) throw new Error("Langue d'origine : modifiez directement votre profil.");
    const hash = sourceHash(row);
    const next = {
      ...tr,
      source_lang: tr.source_lang ?? "fr",
      source_hash: hash,
      langs: {
        ...(tr.langs ?? {}),
        [data.lang]: { ...data.fields, status: "reviewed", source_hash: hash, updated_at: new Date().toISOString() },
      },
    };
    const { error } = await (supabaseAdmin as any).from("therapists").update({ profile_translations: next }).eq("id", row.id);
    if (error) throw new Error("Enregistrement impossible.");
    return { ok: true };
  });

/** Admin : traduit un praticien précis, ou tous ceux dont la traduction manque/est périmée. */
export const adminTranslateProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ therapistId: z.string().uuid().optional(), force: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { translateTherapistRow, TRANSLATION_SELECT } = await import("@/lib/profile-translation.server");
    const { sourceHash } = await import("@/lib/profile-translations");
    let q = (supabaseAdmin as any).from("therapists").select(TRANSLATION_SELECT);
    if (data.therapistId) q = q.eq("id", data.therapistId);
    const { data: rows, error } = await q;
    if (error) throw new Error("Lecture impossible.");
    let done = 0, skipped = 0;
    const failed: string[] = [];
    for (const row of rows ?? []) {
      const tr = row.profile_translations ?? {};
      const complete = tr.source_hash === sourceHash(row) && Object.keys(tr.langs ?? {}).length >= 3;
      if (complete && !data.force) { skipped++; continue; }
      try {
        const next = await translateTherapistRow(row, { force: data.force });
        const { error: e } = await (supabaseAdmin as any).from("therapists").update({ profile_translations: next }).eq("id", row.id);
        if (e) throw e;
        done++;
      } catch {
        failed.push(row.id);
      }
    }
    return { done, skipped, failed };
  });
