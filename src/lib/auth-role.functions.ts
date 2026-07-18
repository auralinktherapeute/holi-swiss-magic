import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnsuredRole = "admin" | "therapist";

// Le site n'a qu'un seul parcours d'inscription (espace thérapeute) : tout
// compte authentifié sans rôle est un thérapeute dont la ligne user_roles
// n'a jamais été créée (inscription directe ou Google, hors flux invitation).
export const ensureTherapistRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ role: EnsuredRole; granted: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error("Impossible de vérifier le rôle du compte.");
    const roles = new Set((data ?? []).map((row) => row.role));
    if (roles.has("admin")) return { role: "admin", granted: false };
    if (roles.has("therapist")) return { role: "therapist", granted: false };
    const { error: upsertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "therapist" }, { onConflict: "user_id,role" });
    if (upsertError) throw new Error("Impossible d'attribuer le rôle thérapeute.");
    return { role: "therapist", granted: true };
  });
