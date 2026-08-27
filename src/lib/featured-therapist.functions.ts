import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

/** Sélection unique du « Thérapeute à la Une » (pilotée depuis l'admin). */

export const getFeaturedSelection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("featured_therapist")
      .select("therapist_id, updated_at")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error("Impossible de lire la sélection.");
    if (!data?.therapist_id) return { therapist: null, updatedAt: data?.updated_at ?? null };
    const { data: th } = await supabaseAdmin
      .from("therapists")
      .select("id, slug, first_name, last_name, status, photo_url")
      .eq("id", data.therapist_id)
      .maybeSingle();
    return { therapist: th ?? null, updatedAt: data.updated_at };
  });

export const searchFeaturableTherapists = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ search: z.string().max(120).default("") }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("therapists")
      .select("id, slug, first_name, last_name, city, canton, photo_url")
      .eq("status", "active")
      .order("last_name", { ascending: true })
      .limit(25);
    const s = data.search.trim();
    if (s) q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,city.ilike.%${s}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Recherche impossible.");
    return { rows: rows ?? [] };
  });

export const setFeaturedTherapist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ therapistId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.therapistId) {
      const { data: th } = await supabaseAdmin
        .from("therapists")
        .select("id, status")
        .eq("id", data.therapistId)
        .maybeSingle();
      if (!th) throw new Error("Thérapeute introuvable.");
      if (th.status !== "active") throw new Error("Seul un profil actif peut être mis à la Une.");
    }
    const { error } = await supabaseAdmin
      .from("featured_therapist")
      .upsert({ id: 1, therapist_id: data.therapistId, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) throw new Error("Enregistrement impossible.");
    return { ok: true };
  });
