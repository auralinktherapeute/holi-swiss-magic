import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import type { TemplateId } from "@/lib/custom-email-templates.shared";

const LEAD_COLS =
  "id,first_name,last_name,email,phone,canton,specialty,source,status,priority,assigned_to,notes,last_contact_at,converted_therapist_id,created_at,updated_at,dedup_status,merged_into_id,merged_at,archived_at";

const THERAPIST_COLS =
  "id,user_id,slug,first_name,last_name,title,short_bio,photo_url,specialties,approaches,languages,address,postal_code,city,canton,consultation_modes,price_min,price_max,currency,insurance_accepted,email,phone,website,status,verified,meta_title,meta_description,booking_note,subscription_plan,years_experience,newsletter_opt_in,onboarding_complete,created_at,updated_at";

async function loadLead(leadId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("crm_leads").select(LEAD_COLS).eq("id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Fiche introuvable.");
  return data as any;
}

/** En-tête de fiche : identité, statuts, santé, compteurs. Une seule requête par ressource. */
export const getCrmContactCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lead = await loadLead(data.leadId);
    const tid: string | null = lead.converted_therapist_id;

    const therapist = tid
      ? (await supabaseAdmin.from("therapists").select(THERAPIST_COLS).eq("id", tid).maybeSingle()).data
      : null;

    const health = tid
      ? (
          await supabaseAdmin
            .from("therapist_health_scores")
            .select("therapist_id,score_total,score_completude,score_contenu,score_activite,score_visibilite,grade,strengths,gaps,computed_at,score_previous")
            .eq("therapist_id", tid)
            .maybeSingle()
        ).data
      : null;

    const [activities, emails, events, articles, reviews, bookings, duplicates] = await Promise.all([
      supabaseAdmin.from("crm_activities").select("id", { count: "exact", head: true }).eq("entity_type", "lead").eq("entity_id", lead.id),
      lead.email
        ? supabaseAdmin.from("email_logs").select("id", { count: "exact", head: true }).eq("recipient_email", lead.email)
        : Promise.resolve({ count: 0 } as any),
      tid ? supabaseAdmin.from("events").select("id", { count: "exact", head: true }).eq("therapist_id", tid) : Promise.resolve({ count: 0 } as any),
      tid ? supabaseAdmin.from("therapist_articles").select("id", { count: "exact", head: true }).eq("therapist_id", tid) : Promise.resolve({ count: 0 } as any),
      tid ? supabaseAdmin.from("reviews").select("id", { count: "exact", head: true }).eq("therapist_id", tid) : Promise.resolve({ count: 0 } as any),
      tid ? supabaseAdmin.from("appointments").select("id", { count: "exact", head: true }).eq("therapist_id", tid) : Promise.resolve({ count: 0 } as any),
      supabaseAdmin
        .from("crm_leads")
        .select("id,source,status,created_at,dedup_status")
        .eq("merged_into_id", lead.id),
    ]);

    return {
      lead,
      therapist: therapist ?? null,
      health: health ?? null,
      counts: {
        activities: activities.count ?? 0,
        emails: emails.count ?? 0,
        events: events.count ?? 0,
        articles: articles.count ?? 0,
        reviews: reviews.count ?? 0,
        bookings: bookings.count ?? 0,
      },
      mergedFiches: duplicates.data ?? [],
    };
  });

const TABS = [
  "notes",
  "emails",
  "activities",
  "events",
  "articles",
  "reviews",
  "billing",
  "bookings",
  "history",
] as const;

/** Chargement différé d'un onglet — n'interroge que ce qui est affiché. */
export const getCrmContactTab = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ leadId: z.string().uuid(), tab: z.enum(TABS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lead = await loadLead(data.leadId);
    const tid: string | null = lead.converted_therapist_id;

    switch (data.tab) {
      case "notes": {
        const { data: rows } = await supabaseAdmin
          .from("crm_activities")
          .select("id,title,body,owner_id,occurred_at,created_at")
          .eq("entity_type", "lead")
          .eq("entity_id", lead.id)
          .eq("type", "note")
          .order("occurred_at", { ascending: false })
          .limit(200);
        return { tab: "notes" as const, rows: rows ?? [] };
      }
      case "emails": {
        if (!lead.email) return { tab: "emails" as const, rows: [] };
        const { data: rows } = await supabaseAdmin
          .from("email_logs")
          .select("id,recipient_email,template_id,subject,status,sent_at,error_message,sent_by")
          .eq("recipient_email", lead.email)
          .order("sent_at", { ascending: false })
          .limit(100);
        return { tab: "emails" as const, rows: rows ?? [] };
      }
      case "activities": {
        const { data: rows } = await supabaseAdmin
          .from("crm_activities")
          .select("id,type,title,body,metadata,owner_id,occurred_at")
          .eq("entity_type", "lead")
          .eq("entity_id", lead.id)
          .order("occurred_at", { ascending: false })
          .limit(200);
        return { tab: "activities" as const, rows: rows ?? [] };
      }
      case "events": {
        if (!tid) return { tab: "events" as const, rows: [] };
        const { data: rows } = await supabaseAdmin
          .from("events")
          .select("id,title,category,event_date,start_time,format,location,status,seats,created_at")
          .eq("therapist_id", tid)
          .order("event_date", { ascending: false })
          .limit(100);
        return { tab: "events" as const, rows: rows ?? [] };
      }
      case "articles": {
        if (!tid) return { tab: "articles" as const, rows: [] };
        const { data: rows } = await supabaseAdmin
          .from("therapist_articles")
          .select("id,titre,slug,statut,date_soumission,date_publication,motif_refus,created_at")
          .eq("therapist_id", tid)
          .order("created_at", { ascending: false })
          .limit(100);
        return { tab: "articles" as const, rows: rows ?? [] };
      }
      case "reviews": {
        if (!tid) return { tab: "reviews" as const, rows: [], average: null };
        const { data: rows } = await supabaseAdmin
          .from("reviews")
          .select("id,rating,comment,author_name,status,therapist_reply,therapist_reply_status,created_at")
          .eq("therapist_id", tid)
          .order("created_at", { ascending: false })
          .limit(100);
        const list = rows ?? [];
        const approved = list.filter((r: any) => r.status === "approved");
        const average = approved.length
          ? Math.round((approved.reduce((s: number, r: any) => s + r.rating, 0) / approved.length) * 10) / 10
          : null;
        return { tab: "reviews" as const, rows: list, average };
      }
      case "billing": {
        if (!tid) return { tab: "billing" as const, rows: [], plan: null };
        const { data: rows } = await supabaseAdmin
          .from("subscription_invoices")
          .select("id,invoice_number,amount_total,currency,status,invoice_date,period_start,period_end,plan_name,hosted_invoice_url,billing_reason")
          .eq("therapist_id", tid)
          .order("invoice_date", { ascending: false })
          .limit(50);
        const { data: th } = await supabaseAdmin.from("therapists").select("subscription_plan").eq("id", tid).maybeSingle();
        return { tab: "billing" as const, rows: rows ?? [], plan: (th as any)?.subscription_plan ?? null };
      }
      case "bookings": {
        // Agrégats uniquement : aucune donnée sensible de patient n'est renvoyée.
        if (!tid) return { tab: "bookings" as const, stats: null, recent: [] };
        const { data: rows } = await supabaseAdmin
          .from("appointments")
          .select("id,status,service_name,start_time,created_at")
          .eq("therapist_id", tid)
          .order("created_at", { ascending: false })
          .limit(200);
        const list = rows ?? [];
        const stats = {
          total: list.length,
          confirmed: list.filter((a: any) => a.status === "confirmed").length,
          completed: list.filter((a: any) => a.status === "completed").length,
          cancelled: list.filter((a: any) => a.status === "cancelled").length,
        };
        return {
          tab: "bookings" as const,
          stats,
          recent: list.slice(0, 20).map((a: any) => ({
            id: a.id,
            status: a.status,
            service_name: a.service_name,
            start_time: a.start_time,
            created_at: a.created_at,
          })),
        };
      }
      case "history": {
        const { data: rows } = await supabaseAdmin
          .from("crm_field_history")
          .select("id,field,old_value,new_value,changed_by,origin,created_at")
          .eq("entity_type", "lead")
          .eq("entity_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(200);
        const { data: merges } = await supabaseAdmin
          .from("crm_merge_log")
          .select("id,merged_lead_ids,performed_by,created_at,reverted_at,reassigned")
          .eq("primary_lead_id", lead.id)
          .order("created_at", { ascending: false })
          .limit(20);
        return { tab: "history" as const, rows: rows ?? [], merges: merges ?? [] };
      }
    }
  });

/** Mise à jour des champs de la fiche + journalisation des modifications. */
export const updateCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        patch: z
          .object({
            first_name: z.string().trim().min(1).max(100).optional(),
            last_name: z.string().trim().min(1).max(100).optional(),
            email: z.string().email().max(255).nullable().optional(),
            phone: z.string().max(50).nullable().optional(),
            canton: z.string().max(60).nullable().optional(),
            specialty: z.string().max(120).nullable().optional(),
            status: z
              .enum(["new","pending","contacted","followup","active","loyal","converted","elite_pro","suspended"])
              .optional(),
            priority: z.enum(["low", "normal", "high"]).optional(),
            assigned_to: z.string().uuid().nullable().optional(),
            notes: z.string().max(4000).nullable().optional(),
          })
          .refine((p) => Object.keys(p).length > 0, "Aucune modification."),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const before = await loadLead(data.leadId);
    const patch: Record<string, unknown> = { ...data.patch, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("crm_leads").update(patch as never).eq("id", data.leadId);
    if (error) throw new Error(error.message);

    const history = Object.entries(data.patch)
      .filter(([f, v]) => String(before[f] ?? "") !== String(v ?? ""))
      .map(([f, v]) => ({
        entity_type: "lead",
        entity_id: data.leadId,
        field: f,
        old_value: before[f] == null ? null : String(before[f]),
        new_value: v == null ? null : String(v),
        changed_by: context.userId,
        origin: "admin",
      }));
    if (history.length) await supabaseAdmin.from("crm_field_history").insert(history);
    return { ok: true, changed: history.length };
  });

/** Aperçu d'un email depuis la fiche (templates existants). */
export const previewCrmContactEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        templateId: z.string().max(60),
        customSubject: z.string().max(200).optional(),
        customMessage: z.string().max(8000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const lead = await loadLead(data.leadId);
    if (!lead.email) throw new Error("Cette fiche n'a pas d'adresse email.");
    const { buildEmail } = await import("./custom-email-templates.server");
    const { subject, html } = buildEmail({
      templateId: data.templateId as TemplateId,
      vars: {
        first_name: lead.first_name,
        last_name: lead.last_name,
        specialty: lead.specialty,
        email: lead.email,
        created_at: lead.created_at,
      },
      customSubject: data.customSubject,
      customMessage: data.customMessage,
    });
    return { subject, html, recipient: lead.email as string };
  });

/** Envoi manuel d'un email depuis la fiche, journalisé dans email_logs + activités. */
export const sendCrmContactEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        templateId: z.string().max(60),
        customSubject: z.string().max(200).optional(),
        customMessage: z.string().max(8000).optional(),
        testTo: z.string().email().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lead = await loadLead(data.leadId);
    const recipient = data.testTo ?? lead.email;
    if (!recipient) throw new Error("Cette fiche n'a pas d'adresse email.");

    const { buildEmail } = await import("./custom-email-templates.server");
    const { subject, html } = buildEmail({
      templateId: data.templateId as TemplateId,
      vars: {
        first_name: lead.first_name,
        last_name: lead.last_name,
        specialty: lead.specialty,
        email: lead.email,
        created_at: lead.created_at,
      },
      customSubject: data.customSubject,
      customMessage: data.customMessage,
    });

    const { emailSenderConfigured, sendRawEmail } = await import("./holiswiss-email.server");
    if (!emailSenderConfigured()) {
      await supabaseAdmin.from("email_logs").insert({
        recipient_email: recipient,
        template_id: data.templateId,
        subject,
        status: "failed",
        error_message: "missing_credentials",
        sent_by: context.userId,
      } as any);
      throw new Error("Service email non configuré.");
    }

    let status = "sent";
    let errorMessage: string | null = null;
    try {
      const res = await sendRawEmail({ to: recipient, subject, html });
      if (!res?.ok) {
        status = "failed";
        errorMessage = res?.error ?? "send_failed";
      }
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : "send_failed";
    }

    await supabaseAdmin.from("email_logs").insert({
      recipient_email: recipient,
      template_id: data.templateId,
      subject,
      status,
      error_message: errorMessage,
      sent_by: context.userId,
    } as any);

    if (!data.testTo) {
      await supabaseAdmin.from("crm_activities").insert({
        entity_type: "lead",
        entity_id: lead.id,
        owner_id: context.userId,
        type: "email",
        title: `Email envoyé : ${subject}`,
        metadata: { template_id: data.templateId, status },
      });
      await supabaseAdmin
        .from("crm_leads")
        .update({ last_contact_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", lead.id);
    }

    if (status === "failed") throw new Error(errorMessage ?? "L'envoi a échoué.");
    return { ok: true, recipient, subject };
  });

/** Archiver / réactiver une fiche (jamais de suppression). */
export const archiveCrmContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ leadId: z.string().uuid(), archived: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("crm_leads")
      .update({ archived_at: data.archived ? now : null, updated_at: now })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("crm_field_history").insert({
      entity_type: "lead",
      entity_id: data.leadId,
      field: "archived_at",
      new_value: data.archived ? now : null,
      changed_by: context.userId,
      origin: "admin",
    });
    return { ok: true };
  });
