import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildInvoiceHtml } from "@/lib/invoice-html.server";
import { sendInvoiceEmail } from "@/lib/holiswiss-email.server";
import {
  getTherapistId, logInvoiceAudit, loadOwnInvoice, loadSettings, loadLines,
  replaceLines, invoiceReadiness, refreshPaymentState,
} from "@/lib/invoice-core.server";
import { buildQrReference, buildScorReference, isQrIban, creditorAccount, missingDebtorFields } from "@/lib/swiss-invoice";

export type TherapistInvoiceSettings = {
  id: string;
  therapist_id: string;
  iban_ou_qr_iban: string;
  qr_iban: string | null;
  adresse_rue: string;
  adresse_npa: string;
  adresse_ville: string;
  adresse_pays: string;
  raison_sociale: string | null;
  numero_ide: string | null;
  telephone: string | null;
  email_pro: string | null;
  logo_url: string | null;
  titulaire_nom: string | null;
  titulaire_adresse: string | null;
  titulaire_npa: string | null;
  titulaire_ville: string | null;
  titulaire_pays: string;
  devise_defaut: string;
  delai_paiement_jours: number;
  conditions_paiement: string | null;
  mention_tva: string | null;
  mode_tva: "exclusive" | "inclusive";
  pied_de_page: string | null;
  numero_tva: string | null;
  assujetti_tva: boolean;
  taux_tva: number | null;
  next_invoice_number: number;
  remise_a_zero_annuelle: boolean;
  invoice_number_year: number | null;
};

export type TherapistInvoiceLine = {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  date_prestation: string | null;
  quantite: number;
  prix_unitaire: number;
  remise_pct: number;
  tva_taux: number;
  montant_ht: number;
  tva_montant: number;
  montant_ttc: number;
};

export type TherapistInvoicePayment = {
  id: string;
  invoice_id: string;
  montant: number;
  date_paiement: string;
  mode_paiement: string;
  reference_bancaire: string | null;
  is_refund: boolean;
  notes: string | null;
  created_at: string;
};

export type TherapistInvoice = {
  id: string;
  therapist_id: string;
  client_id: string | null;
  appointment_id: string | null;
  client_package_id: string | null;
  numero_facture: string;
  annee_facturation: number;
  statut: string;
  montant_ht: number;
  tva_taux: number | null;
  tva_montant: number | null;
  montant_remise: number;
  montant_total: number;
  montant_paye: number;
  currency: string;
  statut_paiement: "en_attente" | "paye" | "annule";
  reference_type: "qrr" | "scor" | "none";
  qr_reference: string | null;
  communication: string | null;
  client_nom: string | null;
  client_adresse: string | null;
  client_npa: string | null;
  client_ville: string | null;
  client_adresse2: string | null;
  client_canton: string | null;
  client_pays: string;
  billing_snapshot_at: string | null;
  client_email: string | null;
  conditions_paiement: string | null;
  notes: string | null;
  pdf_url: string | null;
  date_emission: string;
  date_prestation: string | null;
  date_echeance: string | null;
  date_paiement: string | null;
  locked_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  credit_note_of_id: string | null;
  corrects_invoice_id: string | null;
  metadata: any;
  crm_client_contacts?: { first_name: string; last_name: string; email: string | null };
};

// ── Taux de TVA de référence ────────────────────────────────────────

export const listVatRates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any)
      .from("vat_rates").select("code, label, rate, note")
      .eq("is_active", true).order("rate", { ascending: true });
    return (data ?? []) as { code: string; label: string; rate: number; note: string | null }[];
  });

// ── Réglages facturation ────────────────────────────────────────────

export const getMyInvoiceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const data = await loadSettings(context.supabase, therapistId);
    return data as TherapistInvoiceSettings | null;
  });

const SettingsInput = z.object({
  iban_ou_qr_iban: z.string().trim().min(5, "IBAN requis"),
  qr_iban: z.string().trim().optional().nullable(),
  adresse_rue: z.string().trim().min(1),
  adresse_npa: z.string().trim().min(1),
  adresse_ville: z.string().trim().min(1),
  adresse_pays: z.string().trim().default("CH"),
  raison_sociale: z.string().trim().max(200).optional().nullable(),
  numero_ide: z.string().trim().max(40).optional().nullable(),
  telephone: z.string().trim().max(40).optional().nullable(),
  email_pro: z.string().trim().email().optional().nullable().or(z.literal("")),
  logo_url: z.string().trim().max(500).optional().nullable(),
  titulaire_nom: z.string().trim().max(200).optional().nullable(),
  titulaire_adresse: z.string().trim().max(200).optional().nullable(),
  titulaire_npa: z.string().trim().max(20).optional().nullable(),
  titulaire_ville: z.string().trim().max(120).optional().nullable(),
  titulaire_pays: z.string().trim().default("CH"),
  devise_defaut: z.enum(["CHF", "EUR"]).default("CHF"),
  delai_paiement_jours: z.number().int().min(0).max(365).default(30),
  conditions_paiement: z.string().trim().max(500).optional().nullable(),
  mention_tva: z.string().trim().max(300).optional().nullable(),
  mode_tva: z.enum(["exclusive", "inclusive"]).default("exclusive"),
  pied_de_page: z.string().trim().max(500).optional().nullable(),
  numero_tva: z.string().trim().optional().nullable(),
  assujetti_tva: z.boolean().default(false),
  taux_tva: z.number().min(0).max(100).optional().nullable(),
  next_invoice_number: z.number().int().min(1).default(1),
  remise_a_zero_annuelle: z.boolean().default(true),
});

export const upsertMyInvoiceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SettingsInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const payload = { ...data, email_pro: data.email_pro || null };
    const existing = await loadSettings(context.supabase, therapistId);
    if (existing) {
      const { error } = await (context.supabase as any)
        .from("therapist_invoice_settings").update(payload).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (context.supabase as any)
        .from("therapist_invoice_settings").insert({ ...payload, therapist_id: therapistId });
      if (error) throw new Error(error.message);
    }
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: null, action: "settings_updated",
      actorUserId: context.userId, before: existing, after: payload,
    });
    return { ok: true };
  });

// ── Factures ────────────────────────────────────────────────────────

export const listMyTherapistInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ client_id: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    let q = (context.supabase as any)
      .from("therapist_invoices")
      .select("*, crm_client_contacts(first_name,last_name,email)")
      .eq("therapist_id", therapistId)
      .order("date_emission", { ascending: false });
    if (data.client_id) q = q.eq("client_id", data.client_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as TherapistInvoice[];
  });

export const getTherapistInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const invoice = await loadOwnInvoice(context.supabase, therapistId, data.id);
    const [lines, payments] = await Promise.all([
      loadLines(context.supabase, data.id),
      (context.supabase as any).from("therapist_invoice_payments")
        .select("*").eq("invoice_id", data.id).order("date_paiement", { ascending: true }),
    ]);
    return {
      invoice: invoice as TherapistInvoice,
      lines: lines as TherapistInvoiceLine[],
      payments: (payments.data ?? []) as TherapistInvoicePayment[],
    };
  });

const LineInput = z.object({
  description: z.string().trim().min(1, "Description requise").max(500),
  date_prestation: z.string().trim().optional().nullable(),
  quantite: z.number().positive(),
  prix_unitaire: z.number().min(0),
  remise_pct: z.number().min(0).max(100).default(0),
  tva_taux: z.number().min(0).max(100).default(0),
});

const DraftInput = z.object({
  client_id: z.string().uuid().optional().nullable(),
  appointment_id: z.string().uuid().optional().nullable(),
  client_package_id: z.string().uuid().optional().nullable(),
  client_nom: z.string().trim().min(1, "Nom du destinataire requis").max(200),
  client_adresse: z.string().trim().max(200).optional().nullable(),
  client_npa: z.string().trim().max(20).optional().nullable(),
  client_ville: z.string().trim().max(120).optional().nullable(),
  client_adresse2: z.string().trim().max(200).optional().nullable(),
  client_canton: z.string().trim().max(60).optional().nullable(),
  client_pays: z.string().trim().default("CH"),
  client_email: z.string().trim().email().optional().nullable().or(z.literal("")),
  date_emission: z.string().trim().optional().nullable(),
  date_prestation: z.string().trim().optional().nullable(),
  date_echeance: z.string().trim().optional().nullable(),
  currency: z.enum(["CHF", "EUR"]).default("CHF"),
  reference_type: z.enum(["qrr", "scor", "none"]).default("none"),
  communication: z.string().trim().max(140).optional().nullable(),
  conditions_paiement: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  lines: z.array(LineInput).min(1, "Au moins une ligne de prestation"),
});

/** Crée un brouillon. Aucun numéro définitif n'est consommé avant validation. */
export const createInvoiceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DraftInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const settings = await loadSettings(context.supabase, therapistId);
    if (!settings) throw new Error("Configurez d'abord vos réglages de facturation.");

    const emission = data.date_emission || new Date().toISOString().slice(0, 10);
    const echeance = data.date_echeance
      || new Date(Date.now() + (settings.delai_paiement_jours ?? 30) * 86400000).toISOString().slice(0, 10);

    const { data: inv, error } = await (context.supabase as any)
      .from("therapist_invoices").insert({
        therapist_id: therapistId,
        client_id: data.client_id ?? null,
        appointment_id: data.appointment_id ?? null,
        client_package_id: data.client_package_id ?? null,
        numero_facture: `BROUILLON-${Date.now().toString(36).toUpperCase()}`,
        annee_facturation: Number(emission.slice(0, 4)),
        statut: "brouillon",
        statut_paiement: "en_attente",
        montant_ht: 0, montant_total: 0,
        currency: data.currency,
        reference_type: data.reference_type,
        communication: data.communication ?? null,
        client_nom: data.client_nom,
        client_adresse: data.client_adresse ?? null,
        client_npa: data.client_npa ?? null,
        client_ville: data.client_ville ?? null,
        client_adresse2: data.client_adresse2 ?? null,
        client_canton: data.client_canton ?? null,
        client_pays: data.client_pays || "CH",
        client_email: data.client_email || null,
        conditions_paiement: data.conditions_paiement ?? settings.conditions_paiement ?? null,
        notes: data.notes ?? null,
        date_emission: emission,
        date_prestation: data.date_prestation || null,
        date_echeance: echeance,
        metadata: { client_name: data.client_nom },
      }).select("id").maybeSingle();
    if (error) throw new Error(error.message);

    const totals = await replaceLines(
      context.supabase, therapistId, inv.id, data.lines, settings.mode_tva ?? "exclusive");
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: inv.id, action: "draft_created",
      actorUserId: context.userId, after: { total: totals.montant_total },
    });
    return { id: inv.id as string };
  });

export const updateInvoiceDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    DraftInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const existing = await loadOwnInvoice(context.supabase, therapistId, data.id);
    if (existing.locked_at) {
      throw new Error("Facture validée : créez une facture rectificative ou un avoir.");
    }
    const settings = await loadSettings(context.supabase, therapistId);
    const { id, lines, ...rest } = data;
    const { error } = await (context.supabase as any)
      .from("therapist_invoices").update({
        ...rest,
        client_email: rest.client_email || null,
        date_emission: rest.date_emission || existing.date_emission,
        date_prestation: rest.date_prestation || null,
        date_echeance: rest.date_echeance || existing.date_echeance,
        metadata: { ...(existing.metadata ?? {}), client_name: rest.client_nom },
      }).eq("id", id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    await replaceLines(context.supabase, therapistId, id, lines, settings?.mode_tva ?? "exclusive");
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: id, action: "draft_updated",
      actorUserId: context.userId, before: existing,
    });
    return { ok: true };
  });

/** Contrôles bloquants avant validation / QR-facture. */
export const checkInvoiceReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { errors } = await invoiceReadiness(context.supabase, therapistId, data.id);
    return { ok: errors.length === 0, errors };
  });

/**
 * Valide définitivement : réserve le numéro séquentiel, génère la référence
 * de paiement, verrouille la facture. Irréversible (annulation ou avoir ensuite).
 */
export const validateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    allow_incomplete: z.boolean().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const invoice = await loadOwnInvoice(context.supabase, therapistId, data.id);
    if (invoice.locked_at) throw new Error("Cette facture est déjà validée.");
    const settings = await loadSettings(context.supabase, therapistId);
    if (!settings) throw new Error("Réglages de facturation manquants.");

    // Coordonnées figées à la validation : si elles sont incomplètes on ne
    // bloque pas, mais le thérapeute doit confirmer explicitement (double
    // validation côté interface via le marqueur INCOMPLETE_BILLING).
    const missingDebtor = missingDebtorFields(invoice);
    if (missingDebtor.length && !data.allow_incomplete) {
      throw new Error("INCOMPLETE_BILLING:" + missingDebtor.join(", "));
    }

    const { data: reserved, error: eNum } = await (context.supabase as any)
      .rpc("reserve_next_invoice_number", { _therapist_id: therapistId });
    if (eNum) throw new Error(eNum.message);
    const row0 = Array.isArray(reserved) ? reserved[0] : reserved;
    if (!row0) throw new Error("Impossible de réserver un numéro de facture.");

    const account = creditorAccount(settings);
    let referenceType = invoice.reference_type as "qrr" | "scor" | "none";
    if (isQrIban(account)) referenceType = "qrr";
    else if (referenceType === "qrr") referenceType = "scor";
    const digits = String(row0.numero_facture).replace(/\D/g, "") || String(row0.seq);
    const reference = referenceType === "qrr"
      ? buildQrReference(digits)
      : referenceType === "scor" ? buildScorReference(String(row0.numero_facture)) : null;

    const { error } = await (context.supabase as any).from("therapist_invoices").update({
      numero_facture: row0.numero_facture,
      annee_facturation: row0.annee,
      reference_type: referenceType,
      qr_reference: reference,
      statut: "validee",
      locked_at: new Date().toISOString(),
      billing_snapshot_at: new Date().toISOString(),
    }).eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);

    // Contrôle QR-facture après attribution de la référence.
    const { errors } = await invoiceReadiness(context.supabase, therapistId, data.id);

    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: data.id, action: "invoice_validated",
      actorUserId: context.userId,
      after: {
        numero: row0.numero_facture, reference, referenceType,
        ...(missingDebtor.length ? { adresse_incomplete_confirmee: missingDebtor } : {}),
      },
    });
    return { numero_facture: row0.numero_facture as string, reference, warnings: errors };
  });

export const duplicateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const src = await loadOwnInvoice(context.supabase, therapistId, data.id);
    const lines = await loadLines(context.supabase, data.id);
    const today = new Date().toISOString().slice(0, 10);
    const { data: inv, error } = await (context.supabase as any)
      .from("therapist_invoices").insert({
        therapist_id: therapistId,
        client_id: src.client_id, client_nom: src.client_nom,
        client_adresse: src.client_adresse, client_npa: src.client_npa,
        client_ville: src.client_ville, client_pays: src.client_pays,
        client_adresse2: src.client_adresse2, client_canton: src.client_canton,
        client_email: src.client_email,
        numero_facture: `BROUILLON-${Date.now().toString(36).toUpperCase()}`,
        annee_facturation: Number(today.slice(0, 4)),
        statut: "brouillon", statut_paiement: "en_attente",
        montant_ht: 0, montant_total: 0,
        currency: src.currency, reference_type: src.reference_type,
        conditions_paiement: src.conditions_paiement, notes: src.notes,
        date_emission: today, metadata: src.metadata,
      }).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    const settings = await loadSettings(context.supabase, therapistId);
    await replaceLines(context.supabase, therapistId, inv.id, lines.map((l) => ({
      description: l.description, quantite: Number(l.quantite),
      prix_unitaire: Number(l.prix_unitaire), remise_pct: Number(l.remise_pct),
      tva_taux: Number(l.tva_taux),
    })), settings?.mode_tva ?? "exclusive");
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: inv.id, action: "invoice_duplicated",
      actorUserId: context.userId, note: `Depuis ${src.numero_facture}`,
    });
    return { id: inv.id as string };
  });

export const cancelInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    reason: z.string().trim().min(3, "Motif requis").max(500),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const invoice = await loadOwnInvoice(context.supabase, therapistId, data.id);
    if (invoice.statut === "annulee") throw new Error("Facture déjà annulée.");
    const { error } = await (context.supabase as any).from("therapist_invoices").update({
      statut: "annulee", statut_paiement: "annule",
      cancelled_at: new Date().toISOString(), cancel_reason: data.reason,
    }).eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: data.id, action: "invoice_cancelled",
      actorUserId: context.userId, note: data.reason, before: invoice,
    });
    return { ok: true };
  });

/** Avoir : facture miroir à montants négatifs, rattachée à l'originale. */
export const createCreditNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    reason: z.string().trim().min(3, "Motif requis").max(500),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const src = await loadOwnInvoice(context.supabase, therapistId, data.id);
    if (!src.locked_at) throw new Error("Un avoir ne concerne qu'une facture validée.");
    const lines = await loadLines(context.supabase, data.id);
    const settings = await loadSettings(context.supabase, therapistId);
    const today = new Date().toISOString().slice(0, 10);

    const { data: inv, error } = await (context.supabase as any)
      .from("therapist_invoices").insert({
        therapist_id: therapistId,
        client_id: src.client_id, client_nom: src.client_nom,
        client_adresse: src.client_adresse, client_npa: src.client_npa,
        client_ville: src.client_ville, client_pays: src.client_pays,
        client_adresse2: src.client_adresse2, client_canton: src.client_canton,
        client_email: src.client_email,
        numero_facture: `BROUILLON-AV-${Date.now().toString(36).toUpperCase()}`,
        annee_facturation: Number(today.slice(0, 4)),
        statut: "brouillon", statut_paiement: "en_attente",
        montant_ht: 0, montant_total: 0,
        currency: src.currency, reference_type: "none",
        credit_note_of_id: src.id,
        notes: `Avoir sur la facture ${src.numero_facture} — ${data.reason}`,
        date_emission: today,
        metadata: { client_name: src.client_nom, credit_note_of: src.numero_facture },
      }).select("id").maybeSingle();
    if (error) throw new Error(error.message);

    await replaceLines(context.supabase, therapistId, inv.id, lines.map((l) => ({
      description: `Avoir — ${l.description}`,
      quantite: Number(l.quantite),
      prix_unitaire: -Number(l.prix_unitaire),
      remise_pct: Number(l.remise_pct),
      tva_taux: Number(l.tva_taux),
    })), settings?.mode_tva ?? "exclusive");

    await (context.supabase as any).from("therapist_invoices")
      .update({ statut: "avoir" }).eq("id", inv.id).eq("therapist_id", therapistId);

    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: inv.id, action: "credit_note_created",
      actorUserId: context.userId, note: `Avoir sur ${src.numero_facture} — ${data.reason}`,
    });
    return { id: inv.id as string };
  });

/** Suppression réservée aux brouillons. Une facture validée s'annule. */
export const deleteTherapistInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const invoice = await loadOwnInvoice(context.supabase, therapistId, data.id);
    if (invoice.locked_at) {
      throw new Error("Une facture validée ne peut pas être supprimée : utilisez l'annulation ou un avoir.");
    }
    const { error } = await (context.supabase as any)
      .from("therapist_invoices").delete()
      .eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: null, action: "draft_deleted",
      actorUserId: context.userId, before: invoice,
    });
    return { ok: true };
  });

// ── Paiements ───────────────────────────────────────────────────────

export const addInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    invoice_id: z.string().uuid(),
    montant: z.number().positive("Montant requis"),
    date_paiement: z.string().trim().optional().nullable(),
    mode_paiement: z.enum(["virement", "especes", "carte", "twint", "autre"]).default("virement"),
    reference_bancaire: z.string().trim().max(140).optional().nullable(),
    is_refund: z.boolean().default(false),
    notes: z.string().trim().max(500).optional().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    await loadOwnInvoice(context.supabase, therapistId, data.invoice_id);
    const { error } = await (context.supabase as any).from("therapist_invoice_payments").insert({
      invoice_id: data.invoice_id, therapist_id: therapistId,
      montant: data.montant,
      date_paiement: data.date_paiement || new Date().toISOString().slice(0, 10),
      mode_paiement: data.mode_paiement,
      reference_bancaire: data.reference_bancaire ?? null,
      is_refund: data.is_refund, notes: data.notes ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    const state = await refreshPaymentState(context.supabase, therapistId, data.invoice_id);
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: data.invoice_id,
      action: data.is_refund ? "refund_recorded" : "payment_recorded",
      actorUserId: context.userId, after: { montant: data.montant, ...state },
    });
    return state;
  });

export const deleteInvoicePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(), invoice_id: z.string().uuid(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("therapist_invoice_payments").delete()
      .eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    const state = await refreshPaymentState(context.supabase, therapistId, data.invoice_id);
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: data.invoice_id, action: "payment_deleted",
      actorUserId: context.userId, after: state,
    });
    return state;
  });

// ── Journal d'audit ─────────────────────────────────────────────────

export const listInvoiceAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data: rows } = await (context.supabase as any)
      .from("therapist_invoice_audit")
      .select("id, action, note, created_at")
      .eq("therapist_id", therapistId).eq("invoice_id", data.id)
      .order("created_at", { ascending: false });
    return (rows ?? []) as { id: string; action: string; note: string | null; created_at: string }[];
  });

// ── Rendu HTML / QR-facture ─────────────────────────────────────────

export const renderInvoiceHtml = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { html } = await buildInvoiceHtml(context.supabase, therapistId, data.id);
    return { html };
  });

export const archiveInvoicePdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { html, invoice } = await buildInvoiceHtml(context.supabase, therapistId, data.id);
    const path = `${therapistId}/${invoice.id}.html`;
    const { error: upErr } = await (context.supabase as any).storage
      .from("invoices")
      .upload(path, new Blob([html], { type: "text/html" }), { upsert: true, contentType: "text/html" });
    if (upErr) throw new Error(upErr.message);
    await (context.supabase as any).from("therapist_invoices")
      .update({ pdf_url: path }).eq("id", invoice.id).eq("therapist_id", therapistId);
    const { data: signed } = await (context.supabase as any).storage
      .from("invoices").createSignedUrl(path, 60 * 60 * 24 * 30);
    return { path, signedUrl: signed?.signedUrl ?? null };
  });

// ── Envoi email (déclenché manuellement par le thérapeute) ──────────

export const emailInvoiceToClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    to: z.string().email().optional().nullable(),
    message: z.string().trim().max(2000).optional().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { html, invoice, therapist, clientEmail } =
      await buildInvoiceHtml(context.supabase, therapistId, data.id);
    const to = (data.to ?? invoice.client_email ?? clientEmail ?? "").trim();
    if (!to) throw new Error("Adresse email du client requise.");

    const path = `${therapistId}/${invoice.id}.html`;
    await (context.supabase as any).storage
      .from("invoices")
      .upload(path, new Blob([html], { type: "text/html" }), { upsert: true, contentType: "text/html" });
    await (context.supabase as any).from("therapist_invoices")
      .update({ pdf_url: path }).eq("id", invoice.id).eq("therapist_id", therapistId);
    const { data: signed } = await (context.supabase as any).storage
      .from("invoices").createSignedUrl(path, 60 * 60 * 24 * 30);

    const attachmentB64 = typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(html)))
      : Buffer.from(html, "utf8").toString("base64");

    const res = await sendInvoiceEmail({
      to,
      therapistName: `${therapist?.first_name ?? ""} ${therapist?.last_name ?? ""}`.trim() || "HoliSwiss",
      invoiceNumber: invoice.numero_facture,
      amount: Number(invoice.montant_total),
      currency: invoice.currency,
      viewUrl: signed?.signedUrl ?? "https://holiswiss.ch",
      message: data.message ?? null,
      attachmentHtmlBase64: attachmentB64,
    });

    if (!res.ok) {
      await (context.supabase as any).from("therapist_invoices")
        .update({ statut: "erreur_envoi" }).eq("id", invoice.id).eq("therapist_id", therapistId);
      await logInvoiceAudit(context.supabase, {
        therapistId, invoiceId: invoice.id, action: "email_failed",
        actorUserId: context.userId, note: `${res.status} ${res.error ?? ""}`,
      });
      throw new Error(`Envoi impossible (${res.status}) ${res.error ?? ""}`);
    }

    if (invoice.statut !== "payee" && invoice.statut !== "annulee") {
      await (context.supabase as any).from("therapist_invoices")
        .update({ statut: "envoyee", sent_at: new Date().toISOString() })
        .eq("id", invoice.id).eq("therapist_id", therapistId);
    }
    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: invoice.id, action: "email_sent",
      actorUserId: context.userId, note: to,
    });
    return { ok: true, sentTo: to, signedUrl: signed?.signedUrl ?? null };
  });

// ── Relances (avant / après échéance) ───────────────────────────────
// Aucune relance n'est envoyée automatiquement : le thérapeute déclenche
// chaque envoi. Les factures payées, annulées ou en brouillon sont exclues.

export type InvoiceReminder = {
  id: string;
  numero_facture: string;
  client_nom: string | null;
  client_email: string | null;
  montant_total: number;
  montant_paye: number;
  solde: number;
  currency: string;
  date_echeance: string | null;
  days_to_due: number | null;
  bucket: "en_retard" | "echeance_proche" | "a_venir";
  reminders_sent: number;
  last_reminder_at: string | null;
};

const OPEN_STATUSES = ["validee", "envoyee", "partiellement_payee", "en_retard", "erreur_envoi"];

export const listInvoiceReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);

    const { data: rows, error } = await (context.supabase as any)
      .from("therapist_invoices")
      .select("id, numero_facture, client_nom, client_email, montant_total, montant_paye, currency, date_echeance, statut")
      .eq("therapist_id", therapistId)
      .in("statut", OPEN_STATUSES)
      .order("date_echeance", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);

    const invoices = (rows ?? []) as any[];
    if (invoices.length === 0) return [] as InvoiceReminder[];

    const { data: audit } = await (context.supabase as any)
      .from("therapist_invoice_audit")
      .select("invoice_id, created_at")
      .eq("therapist_id", therapistId)
      .eq("action", "reminder_sent")
      .order("created_at", { ascending: false });

    const counts = new Map<string, { n: number; last: string }>();
    for (const a of (audit ?? []) as any[]) {
      const prev = counts.get(a.invoice_id);
      if (prev) prev.n += 1;
      else counts.set(a.invoice_id, { n: 1, last: a.created_at });
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return invoices.map((inv) => {
      const total = Number(inv.montant_total ?? 0);
      const paid = Number(inv.montant_paye ?? 0);
      let daysToDue: number | null = null;
      if (inv.date_echeance) {
        const due = new Date(`${inv.date_echeance}T00:00:00`);
        daysToDue = Math.round((due.getTime() - startOfToday.getTime()) / 86_400_000);
      }
      const bucket: InvoiceReminder["bucket"] =
        daysToDue === null ? "a_venir"
          : daysToDue < 0 ? "en_retard"
          : daysToDue <= 7 ? "echeance_proche"
          : "a_venir";
      const c = counts.get(inv.id);
      return {
        id: inv.id,
        numero_facture: inv.numero_facture,
        client_nom: inv.client_nom ?? null,
        client_email: inv.client_email ?? null,
        montant_total: total,
        montant_paye: paid,
        solde: Math.round((total - paid) * 100) / 100,
        currency: inv.currency,
        date_echeance: inv.date_echeance ?? null,
        days_to_due: daysToDue,
        bucket,
        reminders_sent: c?.n ?? 0,
        last_reminder_at: c?.last ?? null,
      } satisfies InvoiceReminder;
    });
  });

export const sendInvoiceReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    to: z.string().trim().email().optional().nullable(),
    message: z.string().trim().max(2000).optional().nullable(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const invoice = await loadOwnInvoice(context.supabase, therapistId, data.id);

    if (invoice.statut === "brouillon") {
      throw new Error("Cette facture n'est pas encore validée : elle ne peut pas faire l'objet d'une relance.");
    }
    if (invoice.statut === "payee" || invoice.statut === "annulee") {
      throw new Error("Cette facture est soldée ou annulée : aucune relance n'est nécessaire.");
    }

    const { html, therapist, clientEmail } =
      await buildInvoiceHtml(context.supabase, therapistId, data.id);
    const to = (data.to ?? invoice.client_email ?? clientEmail ?? "").trim();
    if (!to) throw new Error("Adresse email du client requise.");

    const path = `${therapistId}/${invoice.id}.html`;
    await (context.supabase as any).storage
      .from("invoices")
      .upload(path, new Blob([html], { type: "text/html" }), { upsert: true, contentType: "text/html" });
    const { data: signed } = await (context.supabase as any).storage
      .from("invoices").createSignedUrl(path, 60 * 60 * 24 * 30);

    const solde = Math.round((Number(invoice.montant_total ?? 0) - Number(invoice.montant_paye ?? 0)) * 100) / 100;
    const defaultMessage = invoice.date_echeance
      ? `Rappel amical : la facture ${invoice.numero_facture} arrive à échéance le ${new Date(`${invoice.date_echeance}T00:00:00`).toLocaleDateString("fr-CH")}. Solde restant : ${solde.toFixed(2)} ${invoice.currency}.`
      : `Rappel amical concernant la facture ${invoice.numero_facture}. Solde restant : ${solde.toFixed(2)} ${invoice.currency}.`;

    const attachmentB64 = typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(html)))
      : Buffer.from(html, "utf8").toString("base64");

    const res = await sendInvoiceEmail({
      to,
      therapistName: `${therapist?.first_name ?? ""} ${therapist?.last_name ?? ""}`.trim() || "HoliSwiss",
      invoiceNumber: invoice.numero_facture,
      amount: solde,
      currency: invoice.currency,
      viewUrl: signed?.signedUrl ?? "https://holiswiss.ch",
      message: data.message?.trim() || defaultMessage,
      attachmentHtmlBase64: attachmentB64,
    });

    if (!res.ok) {
      await logInvoiceAudit(context.supabase, {
        therapistId, invoiceId: invoice.id, action: "reminder_failed",
        actorUserId: context.userId, note: `${res.status} ${res.error ?? ""}`,
      });
      throw new Error(`Relance impossible (${res.status}) ${res.error ?? ""}`);
    }

    await logInvoiceAudit(context.supabase, {
      therapistId, invoiceId: invoice.id, action: "reminder_sent",
      actorUserId: context.userId, note: to,
    });
    return { ok: true, sentTo: to };
  });

// ── Rapports financiers & exports comptables ────────────────────────

const periodSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((p) => p.from <= p.to, { message: "La date de début doit précéder la date de fin." });

export const getInvoiceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => periodSchema.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { buildInvoiceReport } = await import("@/lib/invoice-report.server");
    return buildInvoiceReport(context.supabase, therapistId, data);
  });

export const exportInvoicesCsv = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    periodSchema.and(z.object({ kind: z.enum(["invoices", "payments"]) }).partial()).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const mod = await import("@/lib/invoice-report.server");
    const csv = data.kind === "payments"
      ? await mod.exportPaymentsCsvData(context.supabase, therapistId, data)
      : await mod.exportInvoicesCsvData(context.supabase, therapistId, data);
    const name = `holiswiss-${data.kind === "payments" ? "encaissements" : "factures"}-${data.from}_${data.to}.csv`;
    return { filename: name, csv };
  });
