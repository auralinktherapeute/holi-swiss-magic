import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    const { data: inv, error } = await (context.supabase as any)
      .from("therapist_invoices")
      .select("*")
      .eq("id", data.id).eq("therapist_id", therapistId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Facture introuvable.");

    const { data: settings } = await (context.supabase as any)
      .from("therapist_invoice_settings")
      .select("*").eq("therapist_id", therapistId).maybeSingle();
    if (!settings) throw new Error("Configurez d'abord vos réglages de facturation.");

    const { data: therapist } = await (context.supabase as any)
      .from("therapists")
      .select("first_name, last_name, email, phone")
      .eq("id", therapistId).maybeSingle();

    const meta = inv.metadata ?? {};
    const clientName = meta.client_name ?? "Client";
    const clientAddress = meta.client_address ?? "";

    // QR-facture (SVG)
    let qrSvg = "";
    try {
      const mod: any = await import("swissqrbill/svg");
      const SwissQRBill = mod.SwissQRBill ?? mod.default;
      const bill = new SwissQRBill({
        currency: inv.currency,
        amount: Number(inv.montant_total),
        reference: inv.qr_reference ?? undefined,
        creditor: {
          name: `${therapist?.first_name ?? ""} ${therapist?.last_name ?? ""}`.trim() || "Thérapeute",
          address: settings.adresse_rue,
          zip: settings.adresse_npa,
          city: settings.adresse_ville,
          account: settings.iban_ou_qr_iban.replace(/\s+/g, ""),
          country: settings.adresse_pays || "CH",
        },
        debtor: clientName ? {
          name: clientName,
          address: clientAddress || "-",
          zip: "",
          city: "",
          country: "CH",
        } : undefined,
      });
      qrSvg = bill.toString();
    } catch (e: any) {
      qrSvg = `<div style="padding:20px;border:1px solid #ddd;color:#a00">QR-facture indisponible: ${e?.message ?? "erreur"}</div>`;
    }

    const rows = (meta.items ?? []).map((it: any) => `
      <tr>
        <td>${escapeHtml(it.description ?? "")}</td>
        <td style="text-align:right">${it.quantite}</td>
        <td style="text-align:right">${Number(it.prix_unitaire).toFixed(2)}</td>
        <td style="text-align:right">${(Number(it.quantite) * Number(it.prix_unitaire)).toFixed(2)}</td>
      </tr>`).join("");

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Facture ${inv.numero_facture}</title>
<style>
  body{font-family:system-ui,sans-serif;color:#111;margin:40px;max-width:800px}
  h1{font-size:22px;margin:0 0 8px}
  .row{display:flex;justify-content:space-between;gap:20px;margin-bottom:24px}
  .card{border:1px solid #eee;padding:12px;border-radius:6px;flex:1}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{padding:8px;border-bottom:1px solid #eee;text-align:left;font-size:14px}
  .tot{font-weight:600}
  .qr{margin-top:32px;border-top:2px dashed #999;padding-top:16px}
  @media print { .noprint{display:none} }
</style></head>
<body>
  <div class="noprint" style="margin-bottom:16px">
    <button onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  </div>
  <h1>Facture ${inv.numero_facture}</h1>
  <div style="color:#666;margin-bottom:20px">Émise le ${new Date(inv.date_emission).toLocaleDateString("fr-CH")}</div>
  <div class="row">
    <div class="card">
      <strong>Émetteur</strong><br/>
      ${escapeHtml(`${therapist?.first_name ?? ""} ${therapist?.last_name ?? ""}`)}<br/>
      ${escapeHtml(settings.adresse_rue)}<br/>
      ${escapeHtml(settings.adresse_npa)} ${escapeHtml(settings.adresse_ville)}<br/>
      ${settings.numero_tva ? `TVA: ${escapeHtml(settings.numero_tva)}<br/>` : ""}
      ${therapist?.email ? `${escapeHtml(therapist.email)}<br/>` : ""}
    </div>
    <div class="card">
      <strong>Destinataire</strong><br/>
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(clientAddress).replace(/\n/g, "<br/>")}
    </div>
  </div>
  ${meta.description ? `<p>${escapeHtml(meta.description)}</p>` : ""}
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Qté</th><th style="text-align:right">P.U.</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" style="color:#888">Aucune ligne détaillée</td></tr>`}</tbody>
    <tfoot>
      <tr><td colspan="3" style="text-align:right">Sous-total HT</td><td style="text-align:right">${Number(inv.montant_ht).toFixed(2)} ${inv.currency}</td></tr>
      ${inv.tva_taux ? `<tr><td colspan="3" style="text-align:right">TVA (${inv.tva_taux}%)</td><td style="text-align:right">${Number(inv.tva_montant).toFixed(2)} ${inv.currency}</td></tr>` : ""}
      <tr class="tot"><td colspan="3" style="text-align:right">Total à payer</td><td style="text-align:right">${Number(inv.montant_total).toFixed(2)} ${inv.currency}</td></tr>
    </tfoot>
  </table>
  <div class="qr">
    <h2 style="font-size:16px">Bulletin QR-facture</h2>
    ${qrSvg}
  </div>
</body></html>`;
    return { html };
  });

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}