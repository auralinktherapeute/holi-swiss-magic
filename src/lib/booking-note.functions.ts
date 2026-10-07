import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Lecture/écriture de la note pratique (NB) du thérapeute connecté.
// La table therapists n'est pas accessible directement depuis le navigateur :
// on passe par le serveur, en vérifiant que la fiche appartient à l'utilisateur.
export const getMyBookingNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { therapistId: string }) => z.object({ therapistId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("therapists")
      .select("booking_note")
      .eq("id", data.therapistId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { booking_note: (row?.booking_note as string | null) ?? null };
  });

export const saveMyBookingNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { therapistId: string; note: string }) =>
    z.object({ therapistId: z.string().uuid(), note: z.string().max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const note = data.note.trim();
    const { data: row, error } = await (supabaseAdmin as any)
      .from("therapists")
      .update({ booking_note: note ? note : null })
      .eq("id", data.therapistId)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Profil thérapeute introuvable");
    return { ok: true };
  });
