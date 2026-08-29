// Logique serveur du pont RDV → facture (« Factures manquantes »).
// Aucune server function ici : uniquement des helpers appelés par cabinet.functions.ts.

import { loadSettings, logInvoiceAudit, replaceLines } from "@/lib/invoice-core.server";
import type { InvoiceLineInput, VatMode } from "@/lib/swiss-invoice";

export type UninvoicedAppointment = {
  id: string;
  client_id: string | null;
  client_name: string;
  client_email: string | null;
  date: string | null;
  time: string | null;
  service: string | null;
  duration_minutes: number;
  suggested_price: number;
  suggested_vat: number;
};

const APPT_COLUMNS =
  "id,client_id,patient_name,patient_email,appointment_date,appointment_time,service_name,duration_minutes,status,invoiced_at";

/**
 * Rendez-vous honorés sans facture. Le prix suggéré vient du tarif plancher du
 * profil ; le taux de TVA des réglages si le thérapeute y est assujetti.
 */
export async function buildUninvoicedAppointments(
  supabase: any,
  therapistId: string,
): Promise<UninvoicedAppointment[]> {
  // Les séances confirmées déjà passées (ou du jour) comptent aussi : le
  // thérapeute oublie souvent de cliquer « Terminée », la séance a pourtant eu
  // lieu et doit pouvoir être facturée / encaissée.
  const todayIso = new Date().toISOString().slice(0, 10);
  const [apptRes, settings, therapistRes] = await Promise.all([
    supabase
      .from("appointments")
      .select(APPT_COLUMNS)
      .eq("therapist_id", therapistId)
      .in("status", ["completed", "confirmed"])
      .lte("appointment_date", todayIso)
      .is("invoiced_at", null)
      .order("appointment_date", { ascending: false })
      .limit(200),
    loadSettings(supabase, therapistId),
    supabase.from("therapists").select("price_min").eq("id", therapistId).maybeSingle(),
  ]);
  if (apptRes.error) throw new Error(apptRes.error.message);

  const rows = (apptRes.data ?? []) as any[];
  const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))] as string[];

  const clients = new Map<string, { name: string; email: string | null }>();
  if (clientIds.length) {
    const { data } = await supabase
      .from("crm_client_contacts")
      .select("id,first_name,last_name,email")
      .eq("therapist_id", therapistId)
      .in("id", clientIds);
    for (const c of (data ?? []) as any[]) {
      clients.set(c.id, {
        name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Client",
        email: c.email ?? null,
      });
    }
  }

  const price = Number(therapistRes?.data?.price_min ?? 0) || 0;
  const vat = settings?.assujetti_tva ? Number(settings.taux_tva ?? 0) || 0 : 0;

  return rows.map((r) => {
    const linked = r.client_id ? clients.get(r.client_id) : undefined;
    return {
      id: r.id as string,
      client_id: (r.client_id ?? null) as string | null,
      client_name: linked?.name ?? (r.patient_name as string) ?? "Client",
      client_email: (linked?.email ?? r.patient_email ?? null) as string | null,
      date: (r.appointment_date ?? null) as string | null,
      time: (r.appointment_time ?? null) as string | null,
      service: (r.service_name ?? null) as string | null,
      duration_minutes: Number(r.duration_minutes ?? 60),
      suggested_price: price,
      suggested_vat: vat,
    };
  });
}

/**
 * Crée un brouillon de facture à partir d'un rendez-vous honoré et marque le
 * rendez-vous comme facturé. Idempotent : un RDV déjà facturé est refusé.
 */
export async function createDraftFromAppointment(
  supabase: any,
  therapistId: string,
  actorUserId: string,
  input: { appointment_id: string; prix_unitaire: number; tva_taux: number; description?: string | null },
): Promise<{ id: string }> {
  const { data: appt, error } = await supabase
    .from("appointments")
    .select(APPT_COLUMNS)
    .eq("id", input.appointment_id)
    .eq("therapist_id", therapistId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!appt) throw new Error("Rendez-vous introuvable.");
  if (appt.invoiced_at) throw new Error("Ce rendez-vous est déjà facturé.");
  const apptPast = String(appt.appointment_date ?? "") <= new Date().toISOString().slice(0, 10);
  if (appt.status !== "completed" && !(appt.status === "confirmed" && apptPast)) {
    throw new Error("Seuls les rendez-vous honorés peuvent être facturés.");
  }

  const settings = await loadSettings(supabase, therapistId);
  if (!settings) throw new Error("Configurez d'abord vos réglages de facturation.");

  let clientName = (appt.patient_name as string) ?? "Client";
  let clientEmail = (appt.patient_email ?? null) as string | null;
  if (appt.client_id) {
    const { data: c } = await supabase
      .from("crm_client_contacts")
      .select("first_name,last_name,email")
      .eq("id", appt.client_id)
      .eq("therapist_id", therapistId)
      .maybeSingle();
    if (c) {
      clientName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || clientName;
      clientEmail = c.email ?? clientEmail;
    }
  }

  const emission = new Date().toISOString().slice(0, 10);
  const echeance = new Date(Date.now() + (settings.delai_paiement_jours ?? 30) * 86400000)
    .toISOString()
    .slice(0, 10);
  const prestation = (appt.appointment_date ?? emission) as string;

  const { data: inv, error: insErr } = await supabase
    .from("therapist_invoices")
    .insert({
      therapist_id: therapistId,
      client_id: appt.client_id ?? null,
      appointment_id: appt.id,
      numero_facture: `BROUILLON-${Date.now().toString(36).toUpperCase()}`,
      annee_facturation: Number(emission.slice(0, 4)),
      statut: "brouillon",
      statut_paiement: "en_attente",
      montant_ht: 0,
      montant_total: 0,
      currency: settings.devise_defaut === "EUR" ? "EUR" : "CHF",
      reference_type: "none",
      client_nom: clientName,
      client_email: clientEmail,
      client_pays: "CH",
      conditions_paiement: settings.conditions_paiement ?? null,
      date_emission: emission,
      date_prestation: prestation,
      date_echeance: echeance,
      metadata: { client_name: clientName, from_appointment: appt.id },
    })
    .select("id")
    .maybeSingle();
  if (insErr) throw new Error(insErr.message);
  if (!inv) throw new Error("Création du brouillon impossible.");

  const description =
    input.description?.trim()
    || `${appt.service_name ?? "Séance"} — ${prestation}${appt.duration_minutes ? ` (${appt.duration_minutes} min)` : ""}`;

  const lines: InvoiceLineInput[] = [
    {
      description,
      date_prestation: prestation,
      quantite: 1,
      prix_unitaire: input.prix_unitaire,
      remise_pct: 0,
      tva_taux: input.tva_taux,
    } as InvoiceLineInput,
  ];
  const totals = await replaceLines(
    supabase,
    therapistId,
    inv.id,
    lines,
    (settings.mode_tva ?? "exclusive") as VatMode,
  );

  const { error: upErr } = await supabase
    .from("appointments")
    .update({
      invoiced_at: new Date().toISOString(),
      invoice_id: inv.id,
      ...(appt.status === "completed" ? {} : { status: "completed" }),
    })
    .eq("id", appt.id)
    .eq("therapist_id", therapistId);
  if (upErr) throw new Error(upErr.message);

  await logInvoiceAudit(supabase, {
    therapistId,
    invoiceId: inv.id as string,
    action: "draft_created_from_appointment",
    actorUserId,
    after: { appointment_id: appt.id, total: totals.montant_total },
  });

  return { id: inv.id as string };
}

/** Marque un RDV comme « à ne pas facturer » sans créer de document. */
export async function skipAppointmentInvoicing(
  supabase: any,
  therapistId: string,
  appointmentId: string,
) {
  const { error } = await supabase
    .from("appointments")
    .update({ invoiced_at: new Date().toISOString() })
    .eq("id", appointmentId)
    .eq("therapist_id", therapistId)
    .is("invoice_id", null);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/**
 * « Séance réglée » : crée la facture depuis le RDV, la valide (numéro
 * séquentiel + référence de paiement) puis enregistre l'encaissement complet.
 * Permet au thérapeute de tracer un paiement reçu en cabinet en un clic.
 */
export async function settleAppointmentPaid(
  supabase: any,
  therapistId: string,
  actorUserId: string,
  input: {
    appointment_id: string;
    prix_unitaire: number;
    tva_taux: number;
    mode_paiement: "virement" | "especes" | "carte" | "twint" | "autre";
    date_paiement?: string | null;
  },
): Promise<{ invoice_id: string; numero_facture: string | null; paid: number; solde: number }> {
  const { buildQrReference, buildScorReference, isQrIban, creditorAccount } = await import(
    "@/lib/swiss-invoice"
  );
  const { loadOwnInvoice, refreshPaymentState } = await import("@/lib/invoice-core.server");

  const { id } = await createDraftFromAppointment(supabase, therapistId, actorUserId, {
    appointment_id: input.appointment_id,
    prix_unitaire: input.prix_unitaire,
    tva_taux: input.tva_taux,
  });

  const settings = await loadSettings(supabase, therapistId);
  const invoice = await loadOwnInvoice(supabase, therapistId, id);

  let numero: string | null = invoice.numero_facture ?? null;
  if (!invoice.locked_at && settings) {
    const { data: reserved, error: eNum } = await supabase.rpc("reserve_next_invoice_number", {
      _therapist_id: therapistId,
    });
    if (eNum) throw new Error(eNum.message);
    const row0 = Array.isArray(reserved) ? reserved[0] : reserved;
    if (!row0) throw new Error("Impossible de réserver un numéro de facture.");

    const account = creditorAccount(settings);
    let referenceType = (invoice.reference_type ?? "none") as "qrr" | "scor" | "none";
    if (isQrIban(account)) referenceType = "qrr";
    else if (referenceType === "qrr") referenceType = "scor";
    const digits = String(row0.numero_facture).replace(/\D/g, "") || String(row0.seq);
    const reference =
      referenceType === "qrr"
        ? buildQrReference(digits)
        : referenceType === "scor"
          ? buildScorReference(String(row0.numero_facture))
          : null;

    const { error: upErr } = await supabase
      .from("therapist_invoices")
      .update({
        numero_facture: row0.numero_facture,
        annee_facturation: row0.annee,
        reference_type: referenceType,
        qr_reference: reference,
        statut: "validee",
        locked_at: new Date().toISOString(),
        billing_snapshot_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("therapist_id", therapistId);
    if (upErr) throw new Error(upErr.message);
    numero = row0.numero_facture as string;

    await logInvoiceAudit(supabase, {
      therapistId,
      invoiceId: id,
      action: "invoice_validated",
      actorUserId,
      after: { numero, reference, referenceType, encaissement_direct: true },
    });
  }

  const fresh = await loadOwnInvoice(supabase, therapistId, id);
  const montant = Number(fresh.montant_total ?? 0);
  if (montant > 0) {
    const { error: payErr } = await supabase.from("therapist_invoice_payments").insert({
      invoice_id: id,
      therapist_id: therapistId,
      montant,
      date_paiement: input.date_paiement || new Date().toISOString().slice(0, 10),
      mode_paiement: input.mode_paiement,
      is_refund: false,
      notes: "Encaissement enregistré depuis le rendez-vous",
      created_by: actorUserId,
    });
    if (payErr) throw new Error(payErr.message);
    await logInvoiceAudit(supabase, {
      therapistId,
      invoiceId: id,
      action: "payment_recorded",
      actorUserId,
      after: { montant, mode: input.mode_paiement },
    });
  }

  const state = await refreshPaymentState(supabase, therapistId, id);
  return { invoice_id: id, numero_facture: numero, paid: state.paid, solde: state.solde };
}
