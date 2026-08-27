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
      .select("id,user_id,slug,first_name,last_name,title,short_bio,bio,photo_url,city,canton,address,postal_code,country,latitude,longitude,website,price_min,price_max,currency,languages,specialties,approaches,consultation_modes,insurance_accepted,verified,subscription_plan,gallery_urls,services,years_experience,google_reviews_url,accreditations,status")
      .eq("slug", data.slug)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw new Error("Impossible de charger le thérapeute.");
    let reviews: Array<{
      id: string;
      rating: number;
      comment: string | null;
      author_name: string | null;
      created_at: string;
    }> = [];
    if (therapist?.id) {
      const { data: rows } = await supabase
        .from("reviews")
        .select("id,rating,comment,author_name,created_at")
        .eq("therapist_id", therapist.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      reviews = (rows ?? []) as any;
    }
    // Certifications : lecture publique, avec leur état de vérification réel
    // (jamais présentées comme vérifiées sans validation administrateur).
    let certifications: Array<{
      id: string;
      name: string | null;
      issuer: string | null;
      year: number | null;
      verification_status: string | null;
      verified_at: string | null;
      expires_at: string | null;
      source_label: string | null;
    }> = [];
    if (therapist?.id) {
      const { data: certs } = await supabase
        .from("therapist_certifications")
        .select("id,name,issuer,year,verification_status,verified_at,expires_at,source_label")
        .eq("therapist_id", therapist.id)
        .order("year", { ascending: false });
      certifications = (certs ?? []) as any;
    }
    // Publications « Voix d'experts » et événements à venir du praticien :
    // lecture serveur (admin) restreinte aux contenus publiés uniquement.
    let articles: Array<{
      id: string;
      slug: string;
      titre: string;
      extrait: string | null;
      image_couverture: string | null;
      date_publication: string | null;
    }> = [];
    let events: Array<{
      id: string;
      title: string;
      short_description: string | null;
      category: string | null;
      event_date: string | null;
      start_time: string | null;
      format: string | null;
      location: string | null;
      is_paid: boolean | null;
      price: number | null;
      image_signed_url: string | null;
    }> = [];
    if (therapist?.id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: arts }, { data: evs }] = await Promise.all([
        supabaseAdmin
          .from("therapist_articles")
          .select("id,slug,titre,extrait,image_couverture,date_publication")
          .eq("therapist_id", therapist.id)
          .eq("statut", "publie")
          .order("date_publication", { ascending: false })
          .limit(6),
        supabaseAdmin
          .from("events")
          .select("id,title,short_description,category,event_date,start_time,format,location,is_paid,price,image_url")
          .eq("therapist_id", therapist.id)
          .eq("status", "published")
          .gte("event_date", today)
          .order("event_date", { ascending: true })
          .limit(6),
      ]);
      articles = (arts ?? []) as any;
      events = await Promise.all(
        ((evs ?? []) as any[]).map(async (e) => {
          let image: string | null = null;
          if (e.image_url) {
            const { data: signed } = await supabaseAdmin.storage
              .from("event-images")
              .createSignedUrl(e.image_url, 60 * 60 * 24 * 7);
            image = signed?.signedUrl ?? null;
          }
          const { image_url, ...rest } = e;
          return { ...rest, image_signed_url: image };
        }),
      );
    }
    return { therapist, reviews, certifications, articles, events };
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

    // Occupations importées de l'agenda personnel du praticien : elles doivent
    // masquer les créneaux, sinon la promesse faite au thérapeute est fausse.
    // Marge de ±1 jour : le fuseau du visiteur est inconnu côté serveur, le
    // recoupement exact est fait par le client.
    const dayStart = new Date(`${data.appointmentDate}T00:00:00Z`);
    const from = new Date(dayStart.getTime() - 86400000).toISOString();
    const to = new Date(dayStart.getTime() + 2 * 86400000).toISOString();
    const { data: busyRows } = await (supabaseAdmin as any)
      .from("therapist_external_busy")
      .select("starts_at, ends_at")
      .eq("therapist_id", data.therapistId)
      .lt("starts_at", to)
      .gt("ends_at", from);

    return {
      slots: rows ?? [],
      busy: ((busyRows ?? []) as Array<{ starts_at: string; ends_at: string }>).map((b) => ({
        startsAt: b.starts_at,
        endsAt: b.ends_at,
      })),
    };
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
    // Colonnes publiques explicites (pas de select("*") : évite d'exposer
    // d'éventuelles colonnes internes de la table events aux visiteurs).
    // Union stricte des champs lus par la page $lang.evenements.$id et des
    // champs utilisés par ce handler (image_url signé, therapist_id).
    const { data: e, error } = await supabaseAdmin
      .from("events")
      .select(
        "id,title,short_description,long_description,category,event_date,start_time,end_time,format,location,online_link,is_paid,price,price_description,seats,image_url,therapist_id,status",
      )
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