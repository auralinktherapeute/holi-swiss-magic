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
    // Un profil existant, une intention d'inscription thérapeute enregistrée
    // sur le compte, ou une fiche thérapeute déjà importée avec le même e-mail
    // valent preuve d'appartenance à l'espace thérapeute.
    if (data.requireProfile) {
      const { data: profile } = await supabaseAdmin
        .from("therapists")
        .select("id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!profile) {
        const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(context.userId);
        const meta = (userRes?.user?.user_metadata ?? {}) as Record<string, unknown>;
        let allowed = meta.signup_intent === "therapist";

        if (!allowed) {
          const email = userRes?.user?.email ?? null;
          if (email) {
            const { data: byEmail } = await supabaseAdmin
              .from("therapists")
              .select("id")
              .ilike("email", email)
              .maybeSingle();
            allowed = Boolean(byEmail);
          }
        }

        if (!allowed) return { role: "user", granted: false };
      }
    }

    const { error: upsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "therapist" }, { onConflict: "user_id,role" });
    if (upsertError) throw new Error("Impossible d'attribuer le rôle thérapeute.");
    return { role: "therapist", granted: true };
  });

/**
 * Lecture SEULE du rôle, faisant autorité (service role, hors RLS).
 * Sert de repli quand la lecture client de `user_roles` renvoie 0 ligne à
 * cause d'un jeton non attaché : conclure « visiteur » renvoyait alors un
 * administrateur vers la page d'accueil.
 */
export const getMyRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ role: EnsuredRole | "moderator" | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible de vérifier le rôle du compte.");
    const roles = new Set((rows ?? []).map((row) => row.role));
    if (roles.has("admin")) return { role: "admin" };
    if (roles.has("therapist")) return { role: "therapist" };
    if (roles.has("moderator")) return { role: "moderator" };
    return { role: rows && rows.length > 0 ? "user" : null };
  });
