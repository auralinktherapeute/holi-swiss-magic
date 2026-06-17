import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

const CATEGORIES = ["atelier", "conference", "retraite", "cercle", "meditation", "autre"] as const;
const FORMATS = ["in_person", "online", "hybrid"] as const;

const eventInputSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1, "Titre requis").max(160),
  short_description: z.string().trim().max(300).nullable().optional(),
  long_description: z.string().trim().max(5000).nullable().optional(),
  category: z.enum(CATEGORIES),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  format: z.enum(FORMATS),
  location: z.string().trim().max(300).nullable().optional(),
  online_link: z.string().trim().max(500).nullable().optional(),
  is_paid: z.boolean(),
  price: z.number().min(0).nullable().optional(),
  price_description: z.string().trim().max(160).nullable().optional(),
  reduced_price: z.number().min(0).nullable().optional(),
  reduced_price_description: z.string().trim().max(160).nullable().optional(),
  seats: z.number().int().min(1).max(100000).nullable().optional(),
  enable_waitlist: z.boolean(),
  image_url: z.string().trim().max(2000).nullable().optional(),
  submit: z.boolean().default(false),
});

async function getOwnedTherapistId(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Profil thérapeute introuvable.");
  if (!data) throw new Error("Complétez votre profil thérapeute avant de créer un événement.");
  return { supabaseAdmin, therapistId: data.id as string };
}

export const listMyEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapistId(context.userId);
    const { data, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (error) throw new Error("Impossible de charger vos événements.");
    return { events: data ?? [] };
  });

export const upsertMyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => eventInputSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapistId(context.userId);

    if (data.submit) {
      if (!data.title?.trim()) throw new Error("Titre obligatoire.");
      if (!data.event_date) throw new Error("Date obligatoire.");
      if (!data.start_time) throw new Error("Heure de début obligatoire.");
      if (!data.seats || data.seats < 1) throw new Error("Nombre de places obligatoire.");
      if (data.is_paid && (data.price == null || data.price < 0)) throw new Error("Prix obligatoire pour un événement payant.");
      if ((data.format === "in_person" || data.format === "hybrid") && !data.location?.trim()) throw new Error("Lieu obligatoire.");
      if ((data.format === "online" || data.format === "hybrid") && !data.online_link?.trim()) throw new Error("Lien de connexion obligatoire.");
    }

    const row = {
      therapist_id: therapistId,
      title: data.title,
      short_description: data.short_description ?? null,
      long_description: data.long_description ?? null,
      category: data.category,
      event_date: data.event_date ?? null,
      start_time: data.start_time ?? null,
      end_time: data.end_time ?? null,
      format: data.format,
      location: data.location ?? null,
      online_link: data.online_link ?? null,
      is_paid: data.is_paid,
      price: data.is_paid ? data.price ?? null : null,
      price_description: data.is_paid ? data.price_description ?? null : null,
      reduced_price: data.is_paid ? data.reduced_price ?? null : null,
      reduced_price_description: data.is_paid ? data.reduced_price_description ?? null : null,
      seats: data.seats ?? null,
      enable_waitlist: data.enable_waitlist,
      image_url: data.image_url ?? null,
      status: data.submit ? "pending_review" : "draft",
    };

    if (data.id) {
      const { data: existing, error: e1 } = await supabaseAdmin
        .from("events").select("therapist_id, status").eq("id", data.id).maybeSingle();
      if (e1 || !existing) throw new Error("Événement introuvable.");
      if (existing.therapist_id !== therapistId) throw new Error("Accès refusé.");
      const { data: updated, error } = await supabaseAdmin
        .from("events").update(row).eq("id", data.id).select("*").single();
      if (error) throw new Error("Échec de la mise à jour.");
      return { event: updated };
    }
    const { data: inserted, error } = await supabaseAdmin
      .from("events").insert(row).select("*").single();
    if (error) throw new Error("Échec de la création.");
    return { event: inserted };
  });

export const deleteMyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapistId(context.userId);
    const { error } = await supabaseAdmin
      .from("events").delete().eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error("Suppression impossible.");
    return { ok: true };
  });

export const signEventImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin
      .storage.from("event-images").createSignedUrl(data.path, 60 * 60 * 24 * 7);
    if (error || !signed) return { url: null as string | null };
    return { url: signed.signedUrl };
  });

// ====== Admin ======

export const listAdminEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["all", "draft", "pending_review", "published", "rejected"]).default("pending_review") }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("events")
      .select("*, therapists!inner(id, first_name, last_name, slug)")
      .order("created_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error("Chargement impossible.");
    return { events: rows ?? [] };
  });

export const reviewEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      action: z.enum(["publish", "reject"]),
      reason: z.string().trim().max(500).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("events").update({
      status: data.action === "publish" ? "published" : "rejected",
      rejection_reason: data.action === "reject" ? data.reason ?? null : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: context.userId,
    }).eq("id", data.id);
    if (error) throw new Error("Mise à jour impossible.");
    return { ok: true };
  });