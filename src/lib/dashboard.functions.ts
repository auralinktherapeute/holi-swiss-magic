import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slotSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  is_active: z.boolean(),
});

const profileSchema = z.object({
  rowId: z.string().uuid().nullable(),
  photo_url: z.string().url().max(2000).nullable(),
  first_name: z.string().min(1).max(120),
  last_name: z.string().max(120),
  city: z.string().max(120),
  postal_code: z.string().max(30),
  address: z.string().max(300),
  phone: z.string().max(60),
  canton: z.string().max(10),
  languages: z.array(z.string().max(50)).max(20),
  price_min: z.number().nullable(),
  price_max: z.number().nullable(),
  currency: z.string().max(10),
  years_experience: z.number().int().min(0).max(100).nullable(),
  specialties: z.array(z.string().max(100)).max(80),
  services: z.array(z.unknown()).max(80),
  short_bio: z.string().max(500).nullable(),
  bio: z.string().max(5000).nullable(),
  google_reviews_url: z.string().url().max(1000).nullable().or(z.literal(null)),
  website: z.string().url().max(1000).nullable().or(z.literal(null)),
  accreditations: z.array(z.unknown()).max(30),
  ide: z.string().max(40).nullable(),
});

async function getOwnedTherapist(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Impossible de vérifier le profil thérapeute.");
  if (!data) throw new Error("Complétez votre profil avant.");
  return { supabaseAdmin, therapistId: data.id as string };
}

export const requireDashboardAuth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ userId: context.userId }));

export const listMyReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .select("id,patient_name,patient_email,patient_phone,appointment_date,appointment_time,status,notes")
      .eq("therapist_id", therapistId)
      .order("appointment_date", { ascending: false })
      .order("appointment_time", { ascending: false });
    if (error) throw new Error("Impossible de charger les réservations.");
    return { therapistId, rows: data ?? [] };
  });

export const getMyPendingReservationCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t } = await supabaseAdmin.from("therapists").select("id").eq("user_id", context.userId).maybeSingle();
    if (!t) return { count: 0 };
    const { count, error } = await supabaseAdmin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("therapist_id", t.id)
      .eq("status", "pending");
    if (error) throw new Error("Impossible de charger les réservations.");
    return { count: count ?? 0 };
  });

export const updateMyAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["confirmed", "cancelled"]) }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const { error } = await supabaseAdmin
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("therapist_id", therapistId);
    if (error) throw new Error("Impossible de mettre à jour la réservation.");
    return { ok: true };
  });

export const listMyAgenda = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const [{ data: availabilities, error: avError }, { data: blockedPeriods, error: bpError }] = await Promise.all([
      supabaseAdmin.from("availabilities").select("id,day_of_week,start_time,end_time,is_active").eq("therapist_id", therapistId),
      supabaseAdmin.from("blocked_periods").select("id,start_date,end_date,reason").eq("therapist_id", therapistId).order("start_date"),
    ]);
    if (avError || bpError) throw new Error("Impossible de charger l'agenda.");
    return { therapistId, availabilities: availabilities ?? [], blockedPeriods: blockedPeriods ?? [] };
  });

export const saveMyAvailabilities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ slots: z.array(slotSchema).min(1).max(7) }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const { error: delError } = await supabaseAdmin.from("availabilities").delete().eq("therapist_id", therapistId);
    if (delError) throw new Error("Impossible d'enregistrer l'agenda.");
    const rows = data.slots.map((slot) => ({ ...slot, therapist_id: therapistId }));
    const { error } = await supabaseAdmin.from("availabilities").insert(rows);
    if (error) throw new Error("Impossible d'enregistrer l'agenda.");
    return { ok: true };
  });

export const addMyBlockedPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: z.string().max(200).optional() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("blocked_periods")
      .insert({ therapist_id: therapistId, start_date: data.start_date, end_date: data.end_date, reason: data.reason || null })
      .select("id,start_date,end_date,reason")
      .single();
    if (error) throw new Error("Impossible d'ajouter la période.");
    return { row };
  });

export const deleteMyBlockedPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const { error } = await supabaseAdmin.from("blocked_periods").delete().eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error("Impossible de supprimer la période.");
    return { ok: true };
  });

export const saveMyTherapistProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(profileSchema)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const slugBase = `${data.first_name}-${data.last_name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "therapeute";
    const payload: any = {
      user_id: context.userId,
      first_name: data.first_name,
      last_name: data.last_name,
      photo_url: data.photo_url,
      city: data.city,
      postal_code: data.postal_code,
      address: data.address,
      phone: data.phone,
      canton: data.canton,
      languages: data.languages,
      price_min: data.price_min,
      price_max: data.price_max,
      currency: data.currency,
      years_experience: data.years_experience,
      specialties: data.specialties,
      services: data.services,
      short_bio: data.short_bio,
      bio: data.bio,
      google_reviews_url: data.google_reviews_url,
      website: data.website,
      accreditations: data.accreditations,
    };

    const result = data.rowId
      ? await supabaseAdmin.from("therapists").update(payload).eq("id", data.rowId).eq("user_id", context.userId).select("id").maybeSingle()
      : await supabaseAdmin.from("therapists").insert({ ...payload, slug: `${slugBase}-${context.userId.slice(0, 6)}` }).select("id").maybeSingle();
    if (result.error || !result.data) throw new Error("Impossible d'enregistrer le profil.");

    const { error: privateError } = await supabaseAdmin
      .from("therapist_private_identifiers")
      .upsert({ therapist_id: result.data.id, user_id: context.userId, ide: data.ide }, { onConflict: "therapist_id" });
    if (privateError) throw new Error("Impossible d'enregistrer l'IDE.");

    return { id: result.data.id as string };
  });

export const addMyTherapistDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ file_url: z.string().url().max(2000), file_name: z.string().min(1).max(255), label: z.string().max(255).nullable(), is_public: z.boolean() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("therapist_documents")
      .insert({ therapist_id: therapistId, file_url: data.file_url, file_name: data.file_name, label: data.label, is_public: data.is_public })
      .select("id,file_url,file_name,label,is_public")
      .single();
    if (error) throw new Error("Impossible d'ajouter le document.");
    return { row };
  });

export const updateMyTherapistDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), label: z.string().max(255).nullable().optional(), is_public: z.boolean().optional() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const patch: { label?: string | null; is_public?: boolean } = {};
    if ("label" in data) patch.label = data.label ?? null;
    if ("is_public" in data) patch.is_public = data.is_public;
    const { error } = await supabaseAdmin.from("therapist_documents").update(patch).eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error("Impossible de mettre à jour le document.");
    return { ok: true };
  });

export const deleteMyTherapistDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin, therapistId } = await getOwnedTherapist(context.userId);
    const { error } = await supabaseAdmin.from("therapist_documents").delete().eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error("Impossible de supprimer le document.");
    return { ok: true };
  });