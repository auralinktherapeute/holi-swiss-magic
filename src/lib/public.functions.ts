import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getWaitingListCount = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("waiting_list")
    .select("id", { count: "exact", head: true });

  if (error) throw new Error("Impossible de charger le compteur.");
  return { count: count ?? 0 };
});

export const getTherapistBySlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(160) }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: therapist, error } = await supabase
      .from("therapists")
      .select("id,user_id,slug,first_name,last_name,title,short_bio,bio,photo_url,city,canton,address,postal_code,country,latitude,longitude,website,price_min,price_max,currency,languages,specialties,approaches,consultation_modes,insurance_accepted,verified,services,years_experience,google_reviews_url,accreditations,status")
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error("Impossible de charger le thérapeute.");
    return { therapist };
  });

export const getBookedAppointmentSlots = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      therapistId: z.string().uuid(),
      appointmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: therapist, error: therapistError } = await supabaseAdmin
      .from("therapists")
      .select("id")
      .eq("id", data.therapistId)
      .eq("status", "active")
      .maybeSingle();

    if (therapistError) throw new Error("Impossible de charger les créneaux.");
    if (!therapist) return { slots: [] };

    const { data: rows, error } = await supabaseAdmin
      .from("appointments")
      .select("appointment_date, appointment_time")
      .eq("therapist_id", data.therapistId)
      .eq("appointment_date", data.appointmentDate)
      .in("status", ["pending", "confirmed"]);

    if (error) throw new Error("Impossible de charger les créneaux.");
    return { slots: rows ?? [] };
  });

export const listPublishedEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("events")
    .select(
      "id,title,short_description,category,event_date,start_time,end_time,format,location,is_paid,price,seats,image_url,therapist_id",
    )
    .eq("status", "published")
    .gte("event_date", today)
    .order("event_date", { ascending: true })
    .limit(200);
  if (error) throw new Error("Impossible de charger les événements.");
  const events = data ?? [];

  const therapistIds = Array.from(new Set(events.map((e: any) => e.therapist_id).filter(Boolean)));
  let therapists: Record<string, { slug: string; first_name: string | null; last_name: string | null }> = {};
  if (therapistIds.length) {
    const { data: ts } = await supabaseAdmin
      .from("therapists")
      .select("id,slug,first_name,last_name")
      .in("id", therapistIds);
    for (const t of ts ?? []) therapists[(t as any).id] = t as any;
  }

  // Sign image URLs
  const enriched = await Promise.all(
    events.map(async (e: any) => {
      let image: string | null = null;
      if (e.image_url) {
        const { data: signed } = await supabaseAdmin.storage
          .from("event-images")
          .createSignedUrl(e.image_url, 60 * 60 * 24 * 7);
        image = signed?.signedUrl ?? null;
      }
      const t = therapists[e.therapist_id];
      return {
        ...e,
        image_signed_url: image,
        therapist_slug: t?.slug ?? null,
        therapist_name: t ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : null,
      };
    }),
  );
  return { events: enriched };
});

export const getPublishedEvent = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: e, error } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", data.id)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error("Impossible de charger l'événement.");
    if (!e) return { event: null };

    let image: string | null = null;
    if ((e as any).image_url) {
      const { data: signed } = await supabaseAdmin.storage
        .from("event-images")
        .createSignedUrl((e as any).image_url, 60 * 60 * 24 * 7);
      image = signed?.signedUrl ?? null;
    }
    const { data: t } = await supabaseAdmin
      .from("therapists")
      .select("id,slug,first_name,last_name,photo_url,city,canton")
      .eq("id", (e as any).therapist_id)
      .maybeSingle();

    return {
      event: { ...(e as any), image_signed_url: image },
      therapist: t ?? null,
    };
  });