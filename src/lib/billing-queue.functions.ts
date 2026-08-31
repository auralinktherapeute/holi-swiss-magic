// File d'attente de facturation : rendez-vous effectués non facturés,
// clients à facturer, exclusion motivée et création d'une facture groupée.
// Le therapist_id est toujours dérivé du jeton, jamais du front-end.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getTherapistId, loadSettings, replaceLines, logInvoiceAudit,
} from "@/lib/invoice-core.server";
import { round2, type InvoiceLineInput } from "@/lib/swiss-invoice";

export type AppointmentToBill = {
  id: string;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  appointment_date: string;
  appointment_time: string | null;
  duration_minutes: number | null;
  service_name: string | null;
  status: string;
  expected_price: number | null;
};

export type ClientToBill = {
  client_id: string;
  client_name: string;
  email: string | null;
  appointments_count: number;
  estimated_amount: number;
  balance_due: number;
};

const OPEN_STATUSES = ["validee", "envoyee", "partiellement_payee", "en_retard", "en_litige"];

async function fetchQueue(supabase: any, therapistId: string) {
  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id,client_id,patient_name,patient_email,appointment_date,appointment_time," +
      "duration_minutes,service_name,status,expected_price",
    )
    .eq("therapist_id", therapistId)
    .eq("status", "completed")
    .is("invoiced_at", null)
    .is("billing_excluded_at", null)
    .order("appointment_date", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as any[];
  const ids = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];
  const names = new Map<string, { name: string; email: string | null }>();
  if (ids.length) {
    const { data: contacts } = await supabase
      .from("crm_client_contacts")
      .select("id,first_name,last_name,email")
      .eq("therapist_id", therapistId)
      .in("id", ids);
    for (const c of (contacts ?? []) as any[]) {
      names.set(c.id, {
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client",
        email: c.email ?? null,
      });
    }
  }

  return rows.map<AppointmentToBill>((r) => ({
    id: r.id,
    client_id: r.client_id ?? null,
    client_name: (r.client_id && names.get(r.client_id)?.name) || r.patient_name || "Client",
    client_email: (r.client_id && names.get(r.client_id)?.email) || r.patient_email || null,
    appointment_date: r.appointment_date,
    appointment_time: r.appointment_time ?? null,
    duration_minutes: r.duration_minutes ?? null,
    service_name: r.service_name ?? null,
    status: r.status,
    expected_price: r.expected_price == null ? null : Number(r.expected_price),
  }));
}

export const listAppointmentsToBill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    return fetchQueue(context.supabase, therapistId);
  });

export const listClientsToBill = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClientToBill[]> => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const queue = await fetchQueue(context.supabase, therapistId);

    const { data: invoices } = await context.supabase
      .from("therapist_invoices")
      .select("client_id,montant_total,montant_paye,statut")
      .eq("therapist_id", therapistId)
      .in("statut", OPEN_STATUSES)
      .limit(2000);

    const map = new Map<string, ClientToBill>();
    for (const a of queue) {
      if (!a.client_id) continue;
      const cur = map.get(a.client_id) ?? {
        client_id: a.client_id, client_name: a.client_name, email: a.client_email,
        appointments_count: 0, estimated_amount: 0, balance_due: 0,
      };
      cur.appointments_count += 1;
      cur.estimated_amount = round2(cur.estimated_amount + (a.expected_price ?? 0));
      map.set(a.client_id, cur);
    }
    for (const i of ((invoices ?? []) as any[])) {
      if (!i.client_id) continue;
      const solde = round2(Number(i.montant_total ?? 0) - Number(i.montant_paye ?? 0));
      if (solde <= 0) continue;
      const cur = map.get(i.client_id);
      if (cur) cur.balance_due = round2(cur.balance_due + solde);
      else {
        map.set(i.client_id, {
          client_id: i.client_id, client_name: "", email: null,
          appointments_count: 0, estimated_amount: 0, balance_due: solde,
        });
      }
    }

    const missing = [...map.values()].filter((c) => !c.client_name).map((c) => c.client_id);
    if (missing.length) {
      const { data: contacts } = await context.supabase
        .from("crm_client_contacts")
        .select("id,first_name,last_name,email")
        .eq("therapist_id", therapistId)
        .in("id", missing);
      for (const c of ((contacts ?? []) as any[])) {
        const cur = map.get(c.id);
        if (cur) {
          cur.client_name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client";
          cur.email = c.email ?? null;
        }
      }
    }
    return [...map.values()].sort((a, b) => b.appointments_count - a.appointments_count);
  });

export const excludeAppointmentFromBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      appointment_id: z.string().uuid(),
      reason: z.string().trim().min(3, "Motif obligatoire").max(300),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("appointments")
      .update({
        billing_excluded_at: new Date().toISOString(),
        billing_exclusion_reason: data.reason,
      })
      .eq("id", data.appointment_id)
      .eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: null, action: "appointment_excluded",
      actorUserId: context.userId,
      after: { appointment_id: data.appointment_id, reason: data.reason },
    });
    return { ok: true };
  });

export const restoreAppointmentToBilling = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ appointment_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("appointments")
      .update({ billing_excluded_at: null, billing_exclusion_reason: null })
      .eq("id", data.appointment_id)
      .eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Crée un brouillon regroupant plusieurs rendez-vous d'un même client.
 * Le trigger SQL empêche qu'un rendez-vous déjà facturé soit repris.
 */
export const createInvoiceFromAppointments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      appointment_ids: z.array(z.string().uuid()).min(1),
      tva_taux: z.number().min(0).max(100).optional(),
    }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const settings = await loadSettings(context.supabase, therapistId);
    if (!settings) throw new Error("Configurez d'abord vos réglages de facturation.");

    const { data: appts, error } = await context.supabase
      .from("appointments")
      .select("id,client_id,patient_name,patient_email,appointment_date,duration_minutes,service_name,expected_price,status,invoiced_at,billing_excluded_at")
      .eq("therapist_id", therapistId)
      .in("id", data.appointment_ids);
    if (error) throw new Error(error.message);
    const rows = (appts ?? []) as any[];
    if (rows.length !== data.appointment_ids.length) {
      throw new Error("Certains rendez-vous sont introuvables.");
    }
    if (rows.some((r) => r.invoiced_at)) {
      throw new Error("Un des rendez-vous sélectionnés est déjà facturé.");
    }
    const clientIds = [...new Set(rows.map((r) => r.client_id))];
    if (clientIds.length > 1) {
      throw new Error("Regroupement impossible : les rendez-vous appartiennent à des clients différents.");
    }
    const clientId = clientIds[0] as string | null;

    let contact: any = null;
    if (clientId) {
      const { data: c } = await context.supabase
        .from("crm_client_contacts")
        .select("id,first_name,last_name,email,address_line1,address_line2,postal_code,city,canton,country,preferred_document_language")
        .eq("therapist_id", therapistId)
        .eq("id", clientId)
        .maybeSingle();
      contact = c;
    }

    const clientNom = contact
      ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim()
      : (rows[0]?.patient_name ?? "Client");

    const emission = new Date().toISOString().slice(0, 10);
    const echeance = new Date(Date.now() + (settings.delai_paiement_jours ?? 30) * 86400000)
      .toISOString().slice(0, 10);
    const taux = data.tva_taux ?? Number(settings.taux_tva ?? 0);

    const { data: inv, error: e1 } = await (context.supabase as any)
      .from("therapist_invoices").insert({
        therapist_id: therapistId,
        client_id: clientId,
        appointment_id: rows.length === 1 ? rows[0].id : null,
        numero_facture: `BROUILLON-${Date.now().toString(36).toUpperCase()}`,
        annee_facturation: Number(emission.slice(0, 4)),
        statut: "brouillon",
        statut_paiement: "en_attente",
        montant_ht: 0, montant_total: 0,
        currency: settings.devise_defaut ?? "CHF",
        reference_type: "none",
        client_nom: clientNom || "Client",
        client_adresse: contact?.address_line1 ?? null,
        client_adresse2: contact?.address_line2 ?? null,
        client_npa: contact?.postal_code ?? null,
        client_ville: contact?.city ?? null,
        client_canton: contact?.canton ?? null,
        client_pays: contact?.country ?? "CH",
        client_email: contact?.email ?? rows[0]?.patient_email ?? null,
        conditions_paiement: settings.conditions_paiement ?? null,
        langue: contact?.preferred_document_language ?? settings.langue_facture ?? "fr",
        date_emission: emission,
        date_prestation: rows.map((r) => r.appointment_date).sort()[0] ?? null,
        date_echeance: echeance,
        metadata: { client_name: clientNom, appointment_ids: rows.map((r) => r.id) },
      }).select("id").maybeSingle();
    if (e1) throw new Error(e1.message);

    const lines: InvoiceLineInput[] = rows.map((r) => ({
      description: r.service_name || "Séance",
      quantite: 1,
      prix_unitaire: Number(r.expected_price ?? 0),
      remise_pct: 0,
      tva_taux: taux,
      date_prestation: r.appointment_date,
      appointment_id: r.id,
      duree_min: r.duration_minutes ?? null,
      unite: "séance",
    }));

    const totals = await replaceLines(
      context.supabase, therapistId, inv.id, lines, settings.mode_tva ?? "exclusive");

    await (context.supabase as any)
      .from("appointments")
      .update({ invoiced_at: new Date().toISOString(), invoice_id: inv.id })
      .in("id", rows.map((r) => r.id))
      .eq("therapist_id", therapistId);

    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: inv.id, action: "draft_created_from_appointments",
      actorUserId: context.userId,
      after: { total: totals.montant_total, appointments: rows.length },
    });

    return { id: inv.id as string };
  });
