import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildInvoiceHtml } from "@/lib/invoice-html.server";
import { sendInvoiceEmail } from "@/lib/holiswiss-email.server";

export type TherapistInvoiceSettings = {
  id: string;
  therapist_id: string;
  iban_ou_qr_iban: string;
  adresse_rue: string;
  adresse_npa: string;
  adresse_ville: string;
  adresse_pays: string;
  numero_tva: string | null;
  assujetti_tva: boolean;
  taux_tva: number | null;
  next_invoice_number: number;
  remise_a_zero_annuelle: boolean;
  invoice_number_year: number | null;
};

export type TherapistInvoice = {
  id: string;
  therapist_id: string;
  client_id: string | null;
  appointment_id: string | null;
  client_package_id: string | null;
  numero_facture: string;
  annee_facturation: number;
  montant_ht: number;
  tva_taux: number | null;
  tva_montant: number | null;
  montant_total: number;
  currency: string;
  statut_paiement: "en_attente" | "paye" | "annule";
  qr_reference: string | null;
  pdf_url: string | null;
  date_emission: string;
  date_paiement: string | null;
  metadata: any;
  crm_client_contacts?: { first_name: string; last_name: string; email: string | null };
};

async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

// ── Réglages facturation ────────────────────────────────────────────

export const getMyInvoiceSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("therapist_invoice_settings")
      .select("*").eq("therapist_id", therapistId).maybeSingle();
    if (error) throw new Error(error.message);
    return data as TherapistInvoiceSettings | null;
  });

const SettingsInput = z.object({
  iban_ou_qr_iban: z.string().trim().min(5, "IBAN requis"),
  adresse_rue: z.string().trim().min(1),
  adresse_npa: z.string().trim().min(1),
  adresse_ville: z.string().trim().min(1),
  adresse_pays: z.string().trim().default("CH"),
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
    const { data: existing } = await (context.supabase as any)
      .from("therapist_invoice_settings")
      .select("id").eq("therapist_id", therapistId).maybeSingle();
    if (existing) {
      const { error } = await (context.supabase as any)
        .from("therapist_invoice_settings").update(data).eq("therapist_id", therapistId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (context.supabase as any)
        .from("therapist_invoice_settings").insert({ ...data, therapist_id: therapistId });
      if (error) throw new Error(error.message);
    }
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

const InvoiceInput = z.object({
  client_id: z.string().uuid().optional().nullable(),
  appointment_id: z.string().uuid().optional().nullable(),
  client_package_id: z.string().uuid().optional().nullable(),
  montant_ht: z.number().min(0),
  tva_taux: z.number().min(0).max(100).optional().nullable(),
  currency: z.string().default("CHF"),
  metadata: z.object({
    description: z.string().trim().optional().nullable(),
    client_name: z.string().trim().min(1, "Nom client requis"),
    client_address: z.string().trim().optional().nullable(),
    items: z.array(z.object({
      description: z.string(),
      quantite: z.number(),
      prix_unitaire: z.number(),
    })).optional().default([]),
  }).default({ client_name: "" } as any),
});

export const createTherapistInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InvoiceInput.parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);

    // Réserver un numéro de facture
    const { data: reserved, error: eNum } = await (context.supabase as any)
      .rpc("reserve_next_invoice_number", { _therapist_id: therapistId });
    if (eNum) throw new Error(eNum.message);
    const row0 = Array.isArray(reserved) ? reserved[0] : reserved;
    if (!row0) throw new Error("Impossible de réserver un numéro de facture. Configurez d'abord vos réglages de facturation.");

    const tvaTaux = data.tva_taux ?? 0;
    const tvaMontant = Math.round(data.montant_ht * tvaTaux) / 100;
    const total = data.montant_ht + tvaMontant;

    const { data: inv, error } = await (context.supabase as any)
      .from("therapist_invoices").insert({
        therapist_id: therapistId,
        client_id: data.client_id ?? null,
        appointment_id: data.appointment_id ?? null,
        client_package_id: data.client_package_id ?? null,
        numero_facture: row0.numero_facture,
        annee_facturation: row0.annee,
        montant_ht: data.montant_ht,
        tva_taux: tvaTaux || null,
        tva_montant: tvaMontant || null,
        montant_total: total,
        currency: data.currency,
        statut_paiement: "en_attente",
        metadata: data.metadata ?? {},
      }).select("id, numero_facture").maybeSingle();
    if (error) throw new Error(error.message);
    return inv as { id: string; numero_facture: string };
  });

export const updateInvoicePaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(),
    statut_paiement: z.enum(["en_attente", "paye", "annule"]),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const patch: any = { statut_paiement: data.statut_paiement };
    if (data.statut_paiement === "paye") patch.date_paiement = new Date().toISOString();
    else patch.date_paiement = null;
    const { error } = await (context.supabase as any)
      .from("therapist_invoices").update(patch)
      .eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTherapistInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("therapist_invoices").delete()
      .eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Génération HTML imprimable avec QR-facture suisse ───────────────

export const renderInvoiceHtml = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { html } = await buildInvoiceHtml(context.supabase, therapistId, data.id);
    return { html };
  });

// ── Archivage dans le bucket "invoices" ─────────────────────────────

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
    const to = (data.to ?? clientEmail ?? "").trim();
    if (!to) throw new Error("Adresse email du client requise.");

    // Archive (upsert) puis signed URL 30 jours
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
    if (!res.ok) throw new Error(`Envoi impossible (${res.status}) ${res.error ?? ""}`);
    return { ok: true, sentTo: to, signedUrl: signed?.signedUrl ?? null };
  });