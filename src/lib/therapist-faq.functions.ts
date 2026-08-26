import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * FAQ du profil public thérapeute.
 *
 * Mêmes conventions que `service-packages.functions.ts` : middleware
 * `requireSupabaseAuth`, résolution du therapist_id depuis l'utilisateur, et
 * lectures/écritures via `context.supabase` — le client de la requête, donc la
 * RLS s'applique. On ne passe jamais par supabaseAdmin ici : rien ne justifie
 * de contourner les politiques pour du contenu que le praticien gère lui-même.
 */

export type TherapistFaq = {
  id: string;
  therapist_id: string;
  question: string;
  answer: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

export const listMyFaqs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("therapist_faqs")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: t } = await (context.supabase as any)
      .from("therapists").select("faq_enabled").eq("id", therapistId).maybeSingle();

    return {
      faqs: (data ?? []) as TherapistFaq[],
      enabled: Boolean(t?.faq_enabled),
    };
  });

const FaqInput = z.object({
  id: z.string().uuid().optional(),
  question: z.string().trim().min(3, "Question trop courte").max(200, "Question trop longue"),
  answer: z.string().trim().min(3, "Réponse trop courte").max(2000, "Réponse trop longue"),
  position: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const upsertFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => FaqInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { id, ...rest } = data;

    if (id) {
      // `.eq("therapist_id")` en plus de la RLS : défense en profondeur, pour
      // qu'une policy assouplie un jour ne suffise pas à toucher autrui.
      const { error } = await (context.supabase as any)
        .from("therapist_faqs")
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
      return { id };
    }

    // Nouvelle entrée : elle se place à la fin.
    const { data: last } = await (context.supabase as any)
      .from("therapist_faqs")
      .select("position")
      .eq("therapist_id", therapistId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const position = rest.position ?? ((last?.position ?? -1) + 1);

    const { data: row, error } = await (context.supabase as any)
      .from("therapist_faqs")
      .insert({ ...rest, position, therapist_id: therapistId })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteFaq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("therapist_faqs")
      .delete()
      .eq("id", data.id)
      .eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Réordonnancement : la liste complète des ids, dans l'ordre voulu. */
export const reorderFaqs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(50) }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await (context.supabase as any)
        .from("therapist_faqs")
        .update({ position: i, updated_at: new Date().toISOString() })
        .eq("id", data.ids[i])
        .eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Interrupteur global « Afficher la FAQ sur mon profil ». */
export const setFaqEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("therapists")
      .update({ faq_enabled: data.enabled })
      .eq("id", therapistId);
    if (error) throw new Error(error.message);
    return { enabled: data.enabled };
  });

/**
 * Lecture publique pour la fiche. Client à clé publiable : la RLS filtre
 * d'elle-même sur `is_active`, `faq_enabled` et le statut du praticien — on ne
 * refait pas ces contrôles ici, une seule source de vérité vaut mieux que deux
 * qui divergent.
 */
export const getPublicFaqs = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: t } = await (supabase as any)
      .from("therapists").select("id").eq("slug", data.slug).eq("status", "active").maybeSingle();
    if (!t?.id) return { faqs: [] as Array<{ question: string; answer: string }> };

    const { data: rows, error } = await (supabase as any)
      .from("therapist_faqs")
      .select("question, answer")
      .eq("therapist_id", t.id)
      .order("position", { ascending: true });
    if (error) return { faqs: [] as Array<{ question: string; answer: string }> };

    return { faqs: (rows ?? []) as Array<{ question: string; answer: string }> };
  });
