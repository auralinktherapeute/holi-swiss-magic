import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { swissDayWindow } from "@/lib/booking-slots";


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
    const { timedRead, timedOptionalRead } = await import("@/lib/read-metrics.server");
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    // Lecture PRINCIPALE : son échec rend la fiche indisponible (503 côté route).
    const therapist = await timedRead("therapist_profile_main", async () => {
      const { data: row, error } = await supabase
        .from("therapists")
        .select("id,user_id,slug,first_name,last_name,title,short_bio,bio,photo_url,city,canton,address,postal_code,country,latitude,longitude,website,price_min,price_max,currency,languages,specialties,approaches,consultation_modes,insurance_accepted,verified,subscription_plan,gallery_urls,services,years_experience,google_reviews_url,accreditations,social_links,status")
        .eq("slug", data.slug)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return row;
    });

    type Review = {
      id: string;
      rating: number;
      comment: string | null;
      author_name: string | null;
      created_at: string;
    };
    type Certification = {
      id: string;
      name: string | null;
      issuer: string | null;
      year: number | null;
      verification_status: string | null;
      verified_at: string | null;
      expires_at: string | null;
      source_label: string | null;
      registry_check_result: string | null;
      registry_checked_at: string | null;
    };
    type Article = {
      id: string;
      slug: string;
      titre: string;
      extrait: string | null;
      image_couverture: string | null;
      date_publication: string | null;
    };
    type PublicEvent = {
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
    };
    type OrgCertification = {
      id: string;
      organization_id: string;
      code: string;
      display_name: string;
      logo_url: string | null;
      badge_color: string | null;
      certification_label: string | null;
      website_url: string | null;
    };

    if (!therapist?.id) {
      return {
        therapist,
        reviews: [] as Review[],
        certifications: [] as Certification[],
        articles: [] as Article[],
        events: [] as PublicEvent[],
        orgCertifications: [] as OrgCertification[],
      };
    }

    const therapistId = therapist.id as string;

    // Lectures SECONDAIRES : indépendantes, donc menées en parallèle, et
    // tolérantes — un échec dégrade la section concernée sans priver le
    // visiteur de la fiche. Aucun badge ni aucune confirmation n'est inventé :
    // les filtres de visibilité (avis approuvés, diplômes validés par un
    // administrateur, associations actives d'organismes actifs) sont inchangés.
    const [reviews, certifications, articles, events, orgCertifications] = await Promise.all([
      timedOptionalRead<Review[]>(
        "therapist_profile_reviews",
        async () => {
          const { data: rows, error } = await supabase
            .from("reviews")
            .select("id,rating,comment,author_name,created_at")
            .eq("therapist_id", therapistId)
            .eq("status", "approved")
            .order("created_at", { ascending: false })
            .limit(20);
          if (error) throw error;
          return (rows ?? []) as any;
        },
        [],
      ),
      // Certifications : lecture publique, avec leur état de vérification réel
      // (jamais présentées comme vérifiées sans validation administrateur).
      timedOptionalRead<Certification[]>(
        "therapist_profile_certifications",
        async () => {
          const { data: certs, error } = await supabase
            .from("therapist_certifications")
            // Projection publique minimale : jamais la source consultée, l'identité
            // de l'administrateur, la déclaration sur l'honneur ni le document.
            // `registry_check_result` / `registry_checked_at` servent uniquement à
            // afficher « Inscription confirmée auprès du registre le [date] ».
            .select(
              "id,name,issuer,year,verification_status,verified_at,expires_at,source_label,registry_check_result,registry_checked_at",
            )
            .eq("therapist_id", therapistId)
            // Visibilité publique : uniquement les diplômes validés par un administrateur.
            .eq("verification_status", "verified")
            .order("year", { ascending: false });
          if (error) throw error;
          return (certs ?? []) as any;
        },
        [],
      ),
      // Publications « Voix d'experts » : lecture serveur restreinte aux
      // contenus publiés uniquement.
      timedOptionalRead<Article[]>(
        "therapist_profile_articles",
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: arts, error } = await supabaseAdmin
            .from("therapist_articles")
            .select("id,slug,titre,extrait,image_couverture,date_publication")
            .eq("therapist_id", therapistId)
            .eq("statut", "publie")
            .order("date_publication", { ascending: false })
            .limit(6);
          if (error) throw error;
          return (arts ?? []) as any;
        },
        [],
      ),
      timedOptionalRead<PublicEvent[]>(
        "therapist_profile_events",
        async () => {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const today = new Date().toISOString().slice(0, 10);
          const { data: evs, error } = await supabaseAdmin
            .from("events")
            .select("id,title,short_description,category,event_date,start_time,format,location,is_paid,price,image_url")
            .eq("therapist_id", therapistId)
            .eq("status", "published")
            .gte("event_date", today)
            .order("event_date", { ascending: true })
            .limit(6);
          if (error) throw error;
          // Une URL signée par image, comme avant, mais toutes en parallèle.
          return (await Promise.all(
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
          )) as any;
        },
        [],
      ),
      // Certifications délivrées par des organismes externes (SVHH, SoulSense…).
      // Uniquement les associations actives d'organismes actifs. Aucune donnée
      // privée (external_reference) n'est renvoyée au public.
      timedOptionalRead<OrgCertification[]>(
        "therapist_profile_org_certifications",
        async () => {
          const { data: rows, error } = await supabase
            .from("therapist_org_certifications")
            .select(
              "id,organization_id,certification_organizations!inner(id,code,display_name,logo_url,badge_color,certification_label,website_url,is_active)",
            )
            .eq("therapist_id", therapistId)
            .eq("status", "active");
          if (error) throw error;
          return ((rows ?? []) as any[])
            .map((r) => {
              const o = Array.isArray(r.certification_organizations)
                ? r.certification_organizations[0]
                : r.certification_organizations;
              if (!o || o.is_active === false) return null;
              return {
                id: r.id as string,
                organization_id: r.organization_id as string,
                code: o.code as string,
                display_name: o.display_name as string,
                logo_url: (o.logo_url ?? null) as string | null,
                badge_color: (o.badge_color ?? null) as string | null,
                certification_label: (o.certification_label ?? null) as string | null,
                website_url: (o.website_url ?? null) as string | null,
              };
            })
            .filter(Boolean) as OrgCertification[];
        },
        [],
      ),
    ]);

    return { therapist, reviews, certifications, articles, events, orgCertifications };
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
    if (!therapist) return { slots: [], booked: [], busy: [] };

    // Intervalles COMPLETS : l'heure de départ seule ne suffit pas à écarter un
    // créneau qui chevauche partiellement une séance plus longue.
    //
    // On cherche les rendez-vous qui RECOUVRENT la journée du praticien, pas
    // ceux dont la date est égale au jour demandé : une séance de la veille qui
    // franchit minuit occupe le début de la journée demandée, et un filtre sur
    // `appointment_date` la rendait invisible.
    const window = swissDayWindow(data.appointmentDate);
    if (!window) throw new Error("Impossible de charger les créneaux.");
    const dayBefore = (() => {
      const d = new Date(`${data.appointmentDate}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();


    const STATUSES = ["pending", "confirmed", "completed", "blocked"];
    const [overlapRes, legacyRes] = await Promise.all([
      // Cas normal : les instants sont renseignés (calculés en base).
      supabaseAdmin
        .from("appointments")
        .select("id, appointment_date, appointment_time, duration_minutes, start_time, end_time")
        .eq("therapist_id", data.therapistId)
        .in("status", STATUSES)
        .not("start_time", "is", null)
        .not("end_time", "is", null)
        .lt("start_time", window.to)
        .gt("end_time", window.from),
      // Repli COHÉRENT pour les lignes historiques sans instants : on prend le
      // jour demandé ET la veille, l'intervalle exact étant reconstruit côté
      // client depuis l'heure murale et la durée.
      supabaseAdmin
        .from("appointments")
        .select("id, appointment_date, appointment_time, duration_minutes, start_time, end_time")
        .eq("therapist_id", data.therapistId)
        .in("status", STATUSES)
        .is("start_time", null)
        .in("appointment_date", [dayBefore, data.appointmentDate]),
    ]);

    if (overlapRes.error || legacyRes.error) throw new Error("Impossible de charger les créneaux.");

    // Occupations importées de l'agenda personnel du praticien : elles doivent
    // masquer les créneaux, sinon la promesse faite au thérapeute est fausse.
    // Marge de ±1 jour : le fuseau du visiteur est inconnu côté serveur, le
    // recoupement exact est fait par le client.
    const dayStart = new Date(`${data.appointmentDate}T00:00:00Z`);
    const from = new Date(dayStart.getTime() - 86400000).toISOString();
    const to = new Date(dayStart.getTime() + 2 * 86400000).toISOString();
    // Lecture ESSENTIELLE : son échec ne doit pas faire croire à des créneaux
    // libres pendant que le praticien est ailleurs.
    const { data: busyRows, error: busyError } = await (supabaseAdmin as any)
      .from("therapist_external_busy")
      .select("starts_at, ends_at")
      .eq("therapist_id", data.therapistId)
      .lt("starts_at", to)
      .gt("ends_at", from);

    if (busyError) throw new Error("Impossible de charger les créneaux.");

    type Row = {
      id?: string;
      appointment_date: string | null;
      appointment_time: string | null;
      duration_minutes: number | null;
      start_time: string | null;
      end_time: string | null;
    };
    const byId = new Map<string, Row>();
    for (const r of [...((overlapRes.data ?? []) as Row[]), ...((legacyRes.data ?? []) as Row[])]) {
      byId.set(String(r.id ?? `${r.appointment_date}-${r.appointment_time}-${r.duration_minutes}`), r);
    }
    const booked = Array.from(byId.values());


    return {
      // `slots` conservé tel quel : la version du site déjà publiée le lit.
      slots: booked.map((r) => ({
        appointment_date: r.appointment_date,
        appointment_time: r.appointment_time,
      })),
      booked: booked.map((r) => ({
        date: r.appointment_date,
        time: r.appointment_time,
        durationMinutes: r.duration_minutes,
        startsAt: r.start_time,
        endsAt: r.end_time,
      })),
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