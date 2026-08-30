// Helper serveur : construit le HTML imprimable d'une facture suisse
// (mentions obligatoires + bulletin QR-facture) et retourne les données brutes.
// Réutilisé par renderInvoiceHtml, archiveInvoicePdf et emailInvoiceToClient.

import {
  creditorAccount, validateQrBill, normalizeIban, round2,
  type ReferenceType,
} from "@/lib/swiss-invoice";
import {
  invoiceDict, normalizeInvoiceLang, INVOICE_LOCALE, QR_LANGUAGE,
} from "@/lib/invoice-i18n";

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
  lines: any[];
  clientEmail: string | null;
  clientName: string;
  qrErrors: string[];
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

  const lang = normalizeInvoiceLang(inv.langue ?? settings.langue_facture);
  const T = invoiceDict(lang);
  const locale = INVOICE_LOCALE[lang];
  const fmtDate = (d: unknown): string => {
    if (!d) return "—";
    const dt = new Date(String(d));
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString(locale);
  };



  const { data: lineRows } = await supabase
    .from("therapist_invoice_lines").select("*")
    .eq("invoice_id", invoiceId).order("position", { ascending: true });
  const meta = inv.metadata ?? {};
  const lines: any[] = (lineRows ?? []).length
    ? (lineRows as any[])
    : (meta.items ?? []).map((it: any) => ({
        description: it.description, quantite: it.quantite,
        prix_unitaire: it.prix_unitaire, remise_pct: 0, tva_taux: inv.tva_taux ?? 0,
        montant_ht: round2(Number(it.quantite) * Number(it.prix_unitaire)),
      }));

  // Identité + contact via service role : email/phone ne sont pas lisibles au niveau colonne.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: therapist } = await supabaseAdmin
    .from("therapists").select("first_name, last_name, email, phone")
    .eq("id", therapistId).maybeSingle();

  // Logo importé dans le bucket privé `invoice-logos` : inliné en data URI pour
  // rester visible dans le PDF imprimé et dans l'email (pas d'URL expirante).
  const STORED_LOGO_PREFIX = "storage://invoice-logos/";
  if (typeof settings.logo_url === "string" && settings.logo_url.startsWith(STORED_LOGO_PREFIX)) {
    try {
      const path = settings.logo_url.slice(STORED_LOGO_PREFIX.length);
      const { data: blob } = await supabaseAdmin.storage.from("invoice-logos").download(path);
      if (blob) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
        const type = blob.type || "image/png";
        settings.logo_url = `data:${type};base64,${btoa(bin)}`;
      } else {
        settings.logo_url = null;
      }
    } catch {
      settings.logo_url = null;
    }
  }

  const emitterName =
    settings.raison_sociale
    || `${therapist?.first_name ?? ""} ${therapist?.last_name ?? ""}`.trim()
    || "Thérapeute";
  const creditorName = settings.titulaire_nom || emitterName;

  const clientName = inv.client_nom ?? meta.client_name ?? "Client";
  let clientEmail: string | null = inv.client_email ?? null;
  if (!clientEmail && inv.client_id) {
    const { data: c } = await supabase
      .from("crm_client_contacts").select("email").eq("id", inv.client_id).maybeSingle();
    clientEmail = c?.email ?? null;
  }

  const account = creditorAccount(settings);
  const referenceType = (inv.reference_type ?? "none") as ReferenceType;
  const qrErrors = validateQrBill({
    settings,
    debtor: inv,
    amount: Number(inv.montant_total),
    currency: inv.currency,
    referenceType,
    reference: inv.qr_reference ?? null,
  });

  let qrSection: string;
  if (qrErrors.length) {
    qrSection = `<div class="qr-missing">
      <strong>${escapeHtml(T.qrMissing)}</strong>
      <ul>${qrErrors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>
    </div>`;
  } else {
    try {
      const mod: any = await import("swissqrbill/svg");
      const SwissQRBill = mod.SwissQRBill ?? mod.default;
      const bill = new SwissQRBill({
        currency: inv.currency,
        amount: Number(inv.montant_total),
        reference: inv.qr_reference ?? undefined,
        message: inv.communication ?? undefined,
        additionalInformation: `${T.invoice} ${inv.numero_facture}`,
        creditor: {
          name: creditorName,
          address: settings.titulaire_adresse || settings.adresse_rue,
          zip: settings.titulaire_npa || settings.adresse_npa,
          city: settings.titulaire_ville || settings.adresse_ville,
          account: normalizeIban(account),
          country: settings.titulaire_pays || settings.adresse_pays || "CH",
        },
        debtor: {
          name: clientName,
          address: inv.client_adresse,
          zip: inv.client_npa,
          city: inv.client_ville,
          country: inv.client_pays || "CH",
        },
      }, { language: QR_LANGUAGE[lang] });
      qrSection = bill.toString();
    } catch (e: any) {
      qrSection = `<div class="qr-missing">${escapeHtml(T.qrUnavailable)} : ${escapeHtml(e?.message ?? "erreur")}</div>`;
    }
  }

  const rows = lines.map((l: any) => {
    const remise = Number(l.remise_pct) || 0;
    return `<tr>
      <td>${escapeHtml(l.description ?? "")}${l.date_prestation ? `<br/><span class="muted">${fmtDate(l.date_prestation)}</span>` : ""}</td>
      <td class="r">${escapeHtml(l.quantite)}</td>
      <td class="r">${Number(l.prix_unitaire).toFixed(2)}</td>
      <td class="r">${remise ? `${remise}%` : "—"}</td>
      <td class="r">${Number(l.tva_taux ?? 0).toFixed(1)}%</td>
      <td class="r">${Number(l.montant_ht ?? 0).toFixed(2)}</td>
    </tr>`;
  }).join("");

  const vatGroups = new Map<number, { base: number; tva: number }>();
  for (const l of lines) {
    const t = Number(l.tva_taux ?? 0);
    const g = vatGroups.get(t) ?? { base: 0, tva: 0 };
    g.base = round2(g.base + Number(l.montant_ht ?? 0));
    g.tva = round2(g.tva + Number(l.tva_montant ?? 0));
    vatGroups.set(t, g);
  }
  const vatRows = [...vatGroups.entries()]
    .filter(([t]) => t > 0)
    .map(([t, g]) => `<tr><td colspan="5" class="r">${escapeHtml(T.vatOn(t.toFixed(1), g.base.toFixed(2)))}</td><td class="r">${g.tva.toFixed(2)}</td></tr>`)
    .join("");

  const mentionTva = settings.assujetti_tva
    ? (settings.mention_tva || (settings.mode_tva === "inclusive" ? T.vatIncluded : T.vatExtra))
    : (settings.mention_tva || T.notVatLiable);

  const solde = round2(Number(inv.montant_total) - Number(inv.montant_paye ?? 0));

  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(T.invoice)} ${escapeHtml(inv.numero_facture)}</title>
<style>
  :root { --ink:#1c1c1e; --muted:#6b7280; --line:#e5e7eb; --accent:#7c3aed; }
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);margin:0;padding:40px;max-width:820px;line-height:1.5}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid var(--accent);padding-bottom:16px}
  .logo{max-height:64px;max-width:200px}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:var(--muted);font-size:12px}
  .status{display:inline-block;padding:3px 10px;border-radius:999px;background:#f3f0ff;color:var(--accent);font-size:12px;font-weight:600}
  .grid{display:flex;gap:20px;margin:24px 0}
  .card{flex:1;border:1px solid var(--line);border-radius:8px;padding:12px;font-size:13px}
  .card strong{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);margin-bottom:6px}
  table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px}
  th{background:#faf9ff;text-align:left;padding:8px;border-bottom:2px solid var(--line);font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  td{padding:8px;border-bottom:1px solid var(--line)}
  .r{text-align:right}
  .tot td{font-weight:700;font-size:15px;border-top:2px solid var(--ink);border-bottom:none}
  .qr{margin-top:36px;border-top:2px dashed #999;padding-top:8px}
  .qr-missing{margin-top:24px;border:1px solid #f0b429;background:#fffbeb;padding:14px;border-radius:8px;font-size:13px}
  .qr-missing ul{margin:8px 0 0 18px}
  footer{margin-top:28px;padding-top:12px;border-top:1px solid var(--line);font-size:11px;color:var(--muted)}
  @media print { .noprint{display:none} body{padding:16mm} }
</style></head>
<body>
  <div class="noprint" style="margin-bottom:16px">
    <button onclick="window.print()" style="padding:8px 16px;border-radius:8px;border:1px solid #7c3aed;background:#7c3aed;color:#fff;font-size:14px;cursor:pointer;min-height:44px">
      ${escapeHtml(T.print)}
    </button>
  </div>

  <header>
    <div>
      ${settings.logo_url ? `<img class="logo" src="${escapeHtml(settings.logo_url)}" alt="Logo ${escapeHtml(emitterName)}"/>` : `<div style="font-size:18px;font-weight:700">${escapeHtml(emitterName)}</div>`}
    </div>
    <div style="text-align:right">
      <h1>${escapeHtml(T.invoice)} ${escapeHtml(inv.numero_facture)}</h1>
      <div class="muted">${escapeHtml(T.issuedOn)} ${fmtDate(inv.date_emission)}${inv.date_prestation ? ` · ${escapeHtml(T.serviceOn)} ${fmtDate(inv.date_prestation)}` : ""}</div>
      <div class="muted">${escapeHtml(T.dueDate)} : ${fmtDate(inv.date_echeance)}</div>
      <div style="margin-top:6px"><span class="status">${escapeHtml(T.statuses[inv.statut] ?? inv.statut ?? "")}</span></div>
    </div>
  </header>

  <div class="grid">
    <div class="card">
      <strong>${escapeHtml(T.emitter)}</strong>
      ${escapeHtml(emitterName)}<br/>
      ${escapeHtml(settings.adresse_rue)}<br/>
      ${escapeHtml(settings.adresse_npa)} ${escapeHtml(settings.adresse_ville)}<br/>
      ${escapeHtml(settings.adresse_pays || "CH")}<br/>
      ${settings.telephone ? `${escapeHtml(settings.telephone)}<br/>` : ""}
      ${settings.email_pro || therapist?.email ? `${escapeHtml(settings.email_pro || therapist?.email)}<br/>` : ""}
      ${settings.numero_ide ? `${escapeHtml(T.ide)} : ${escapeHtml(settings.numero_ide)}<br/>` : ""}
      ${settings.assujetti_tva && settings.numero_tva ? `${escapeHtml(T.vatNo)} : ${escapeHtml(settings.numero_tva)}<br/>` : ""}
    </div>
    <div class="card">
      <strong>${escapeHtml(T.recipient)}</strong>
      ${escapeHtml(clientName)}<br/>
      ${escapeHtml(inv.client_adresse ?? "")}<br/>
      ${escapeHtml(inv.client_npa ?? "")} ${escapeHtml(inv.client_ville ?? "")}<br/>
      ${escapeHtml(inv.client_pays ?? "CH")}
    </div>
  </div>

  ${inv.notes ? `<p style="font-size:13px">${escapeHtml(inv.notes)}</p>` : ""}

  <table>
    <thead><tr>
      <th>${escapeHtml(T.service)}</th><th class="r">${escapeHtml(T.qty)}</th><th class="r">${escapeHtml(T.unitPrice)}</th>
      <th class="r">${escapeHtml(T.discount)}</th><th class="r">${escapeHtml(T.vat)}</th><th class="r">${escapeHtml(T.amountExcl)}</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">${escapeHtml(T.noLines)}</td></tr>`}</tbody>
    <tfoot>
      ${Number(inv.montant_remise) > 0 ? `<tr><td colspan="5" class="r">${escapeHtml(T.totalDiscount)}</td><td class="r">− ${Number(inv.montant_remise).toFixed(2)}</td></tr>` : ""}
      <tr><td colspan="5" class="r">${escapeHtml(T.subtotal)}</td><td class="r">${Number(inv.montant_ht).toFixed(2)} ${escapeHtml(inv.currency)}</td></tr>
      ${vatRows}
      <tr class="tot"><td colspan="5" class="r">${escapeHtml(settings.assujetti_tva ? T.totalToPayIncl : T.totalToPay)}</td><td class="r">${Number(inv.montant_total).toFixed(2)} ${escapeHtml(inv.currency)}</td></tr>
      ${Number(inv.montant_paye ?? 0) > 0 ? `<tr><td colspan="5" class="r">${escapeHtml(T.alreadyPaid)}</td><td class="r">${Number(inv.montant_paye).toFixed(2)}</td></tr>
      <tr><td colspan="5" class="r">${escapeHtml(T.balance)}</td><td class="r">${solde.toFixed(2)} ${escapeHtml(inv.currency)}</td></tr>` : ""}
    </tfoot>
  </table>

  <div class="muted">${escapeHtml(mentionTva)}</div>
  ${inv.conditions_paiement || settings.conditions_paiement
    ? `<p style="font-size:12px">${escapeHtml(inv.conditions_paiement || settings.conditions_paiement)}</p>` : ""}
  <div class="muted">
    ${escapeHtml(T.paymentTerms(String(settings.delai_paiement_jours ?? 30)))} ·
    ${escapeHtml(normalizeIban(account).replace(/(.{4})/g, "$1 ").trim())}
    ${inv.qr_reference ? ` · ${escapeHtml(T.reference)} : ${escapeHtml(inv.qr_reference)}` : ""}
  </div>

  <div class="qr">${qrSection}</div>

  <footer>
    ${settings.pied_de_page ? `${escapeHtml(settings.pied_de_page)}<br/>` : ""}
    ${escapeHtml(T.footer)}
  </footer>
</body></html>`;

  return { html, invoice: inv, settings, therapist, lines, clientEmail, clientName, qrErrors };
}
