import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnsuredRole = "admin" | "therapist" | "user";

/**
 * Séparation stricte « avis » ↔ « espace thérapeute ».
 *
 * Se connecter avec Google pour laisser un AVIS (comme sur TripAdvisor) ne doit
 * JAMAIS créer un thérapeute ni un espace thérapeute. Ce sont deux choses
 * distinctes. On n'auto-attribue donc le rôle `therapist` que :
 *   - dans le parcours d'INSCRIPTION explicite (requireProfile omis/false) ;
 *   - ou pour RÉPARER un thérapeute existant qui a déjà un profil
 *     (requireProfile:true → on exige un `therapists` row avant de promouvoir).
 *
 * Un compte authentifié sans profil (typiquement une connexion faite uniquement
 * pour laisser un avis) reste un simple visiteur (role "user").
 */
export const ensureTherapistRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requireProfile?: boolean } | undefined) => ({
    requireProfile: input?.requireProfile === true,
  }))
  .handler(async ({ context, data }): Promise<{ role: EnsuredRole; granted: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible de vérifier le rôle du compte.");
    const roles = new Set((rows ?? []).map((row) => row.role));
    if (roles.has("admin")) return { role: "admin", granted: false };
    if (roles.has("therapist")) return { role: "therapist", granted: false };

    // Garde-fou : ne pas transformer un « reviewer » en thérapeute.
    if (data.requireProfile) {
      const { data: profile } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!profile) return { role: "user", granted: false };
    }

    const { error: upsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "therapist" }, { onConflict: "user_id,role" });
    if (upsertError) throw new Error("Impossible d'attribuer le rôle thérapeute.");
    return { role: "therapist", granted: true };
  });
