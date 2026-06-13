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
  .inputValidator(z.object({ slug: z.string().min(1).max(160) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: therapist, error } = await supabaseAdmin
      .from("therapists")
      .select("first_name,last_name,title,city,canton,bio,specialties,photo_url,cover_image_url")
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