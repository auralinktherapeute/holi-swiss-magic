// Helper serveur : construit le HTML d'une facture + retourne les données brutes.
// Réutilisé par renderInvoiceHtml, archiveInvoicePdf et emailInvoiceToClient.

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}

export type InvoiceBuildResult = {
  html: string;
  invoice: any;
  settings: any;
  therapist: any;
  clientEmail: string | null;
  clientName: string;
};

export async function buildInvoiceHtml(
  supabase: any,
  therapistId: string,
  invoiceId: string,
): Promise<InvoiceBuildResult> {
  const { data: inv, error } = await supabase
    .from("therapist_invoices").select("*")
    .eq("id", invoiceId).eq("therapist_id", therapistId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!inv) throw new Error("Facture introuvable.");

  const { data: settings } = await supabase
    .from("therapist_invoice_settings").select("*")
    .eq("therapist_id", therapistId).maybeSingle();
  if (!settings) throw new Error("Configurez d'abord vos réglages de facturation.");

  // Load therapist identity + contact via service role: `email` / `phone` are no
  // longer readable by anon or authenticated roles at the column level.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: therapist } = await supabaseAdmin
    .from("therapists").select("first_name, last_name, email, phone")
    .eq("id", therapistId).maybeSingle();

  const meta = inv.metadata ?? {};
  const clientName = meta.client_name ?? "Client";
  const clientAddress = meta.client_address ?? "";

  let clientEmail: string | null = null;
  if (inv.client_id) {
    const { data: c } = await supabase
      .from("crm_client_contacts").select("email").eq("id", inv.client_id).maybeSingle();
    clientEmail = c?.email ?? null;
  }

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
        account: String(settings.iban_ou_qr_iban).replace(/\s+/g, ""),
        country: settings.adresse_pays || "CH",
      },
      debtor: clientName ? {
        name: clientName, address: clientAddress || "-",
        zip: "", city: "", country: "CH",
      } : undefined,
    });
    qrSvg = bill.toString();
  } catch (e: any) {
    qrSvg = `<div style="padding:20px;border:1px solid #ddd;color:#a00">QR-facture indisponible: ${escapeHtml(e?.message ?? "erreur")}</div>`;
  }

  const rows = (meta.items ?? []).map((it: any) => `
    <tr>
      <td>${escapeHtml(it.description ?? "")}</td>
      <td style="text-align:right">${escapeHtml(it.quantite)}</td>
      <td style="text-align:right">${Number(it.prix_unitaire).toFixed(2)}</td>
      <td style="text-align:right">${(Number(it.quantite) * Number(it.prix_unitaire)).toFixed(2)}</td>
    </tr>`).join("");

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"/>
<title>Facture ${escapeHtml(inv.numero_facture)}</title>
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
  <h1>Facture ${escapeHtml(inv.numero_facture)}</h1>
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

  return { html, invoice: inv, settings, therapist, clientEmail, clientName };
}