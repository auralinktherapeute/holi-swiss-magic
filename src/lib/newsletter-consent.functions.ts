import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Met à jour le consentement newsletter du thérapeute connecté.
 * Gère les timestamps d'opt-in et de désinscription de manière sécurisée.
 */
export const updateMyNewsletterConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        optIn: z.boolean(),
      })
      .parse(data)
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: therapist } = await supabaseAdmin
      .from("therapists")
      .select("id,newsletter_opt_in")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!therapist) {
      throw new Error("Profil thérapeute introuvable.");
    }

    const now = new Date().toISOString();
    const patch: {
      newsletter_opt_in: boolean;
      newsletter_opt_in_at?: string | null;
      newsletter_unsubscribed_at?: string | null;
    } = {
      newsletter_opt_in: data.optIn,
    };

    if (data.optIn) {
      patch.newsletter_opt_in_at = now;
      patch.newsletter_unsubscribed_at = null;
    } else {
      patch.newsletter_unsubscribed_at = now;
    }

    const { error } = await supabaseAdmin
      .from("therapists")
      .update(patch)
      .eq("id", (therapist as { id: string }).id)
      .eq("user_id", context.userId);

    if (error) {
      throw new Error("Impossible de mettre à jour le consentement newsletter.");
    }

    return { ok: true, optIn: data.optIn };
  });
