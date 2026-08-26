// Rapports financiers de la facturation thérapeute : CA, TVA, exports.
// Serveur uniquement — appelé depuis therapist-invoices.functions.ts.

import { round2 } from "@/lib/swiss-invoice";

/** Statuts exclus du chiffre d'affaires : non émis ou annulés. */
export const EXCLUDED_REPORT_STATUSES = ["brouillon", "annulee"];

export type ReportPeriod = { from: string; to: string };

export type MonthlyBucket = {
  month: string;          // "2026-01"
  invoices: number;
  ht: number;
  tva: number;
  ttc: number;
  encaisse: number;
};

export type VatBucket = {
  rate: number;           // 8.1, 2.6, 0 …
  base_ht: number;
  tva: number;
};

export type InvoiceReport = {
  period: ReportPeriod;
  currency: string;
  totals: {
    invoices: number;
    ht: number;
    tva: number;
    ttc: number;
    encaisse: number;      // paiements nets encaissés sur la période
    solde: number;         // TTC facturé - encaissé sur les factures de la période
    en_retard: number;
    montant_en_retard: number;
  };
  monthly: MonthlyBucket[];
  vat: VatBucket[];
  vat_mode: "facture" | "encaisse";
  assujetti_tva: boolean;
};

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Construit le rapport financier d'un thérapeute sur une période [from, to] inclusive. */
export async function buildInvoiceReport(
  supabase: any,
  therapistId: string,
  period: ReportPeriod,
): Promise<InvoiceReport> {
  const { data: invRows, error } = await supabase
    .from("therapist_invoices")
    .select("id, numero_facture, statut, montant_ht, tva_montant, montant_total, montant_paye, currency, date_emission, date_echeance")
    .eq("therapist_id", therapistId)
    .gte("date_emission", period.from)
    .lte("date_emission", period.to)
    .order("date_emission", { ascending: true });
  if (error) throw new Error(error.message);

  const invoices = ((invRows ?? []) as any[]).filter(
    (i) => !EXCLUDED_REPORT_STATUSES.includes(i.statut),
  );

  const { data: settings } = await supabase
    .from("therapist_invoice_settings")
    .select("devise_defaut, assujetti_tva")
    .eq("therapist_id", therapistId)
    .maybeSingle();

  const monthly = new Map<string, MonthlyBucket>();
  const vat = new Map<number, VatBucket>();
  let ht = 0, tva = 0, ttc = 0, encaisse = 0, retard = 0, montantRetard = 0;

  const ids = invoices.map((i) => i.id);
  const lines: any[] = [];
  // Découpe en lots pour rester sous la limite d'URL de PostgREST.
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("therapist_invoice_lines")
      .select("invoice_id, montant_ht, tva_taux, tva_montant")
      .in("invoice_id", ids.slice(i, i + 100));
    lines.push(...((data ?? []) as any[]));
  }

  for (const l of lines) {
    const rate = Number(l.tva_taux ?? 0);
    const prev = vat.get(rate) ?? { rate, base_ht: 0, tva: 0 };
    prev.base_ht = round2(prev.base_ht + Number(l.montant_ht ?? 0));
    prev.tva = round2(prev.tva + Number(l.tva_montant ?? 0));
    vat.set(rate, prev);
  }

  const today = new Date().toISOString().slice(0, 10);

  for (const inv of invoices) {
    const iHt = Number(inv.montant_ht ?? 0);
    const iTva = Number(inv.tva_montant ?? 0);
    const iTtc = Number(inv.montant_total ?? 0);
    const iPaid = Number(inv.montant_paye ?? 0);
    ht += iHt; tva += iTva; ttc += iTtc; encaisse += iPaid;
    if (
      inv.date_echeance && inv.date_echeance < today &&
      iPaid < iTtc && !["payee", "annulee"].includes(inv.statut)
    ) {
      retard += 1;
      montantRetard += iTtc - iPaid;
    }
    const k = monthKey(String(inv.date_emission));
    const b = monthly.get(k) ?? { month: k, invoices: 0, ht: 0, tva: 0, ttc: 0, encaisse: 0 };
    b.invoices += 1;
    b.ht = round2(b.ht + iHt);
    b.tva = round2(b.tva + iTva);
    b.ttc = round2(b.ttc + iTtc);
    b.encaisse = round2(b.encaisse + iPaid);
    monthly.set(k, b);
  }

  return {
    period,
    currency: settings?.devise_defaut ?? invoices[0]?.currency ?? "CHF",
    totals: {
      invoices: invoices.length,
      ht: round2(ht), tva: round2(tva), ttc: round2(ttc),
      encaisse: round2(encaisse),
      solde: round2(ttc - encaisse),
      en_retard: retard,
      montant_en_retard: round2(montantRetard),
    },
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
    vat: [...vat.values()].sort((a, b) => b.rate - a.rate),
    vat_mode: "facture",
    assujetti_tva: Boolean(settings?.assujetti_tva),
  };
}

// ── Exports CSV (séparateur ";" — attendu par Excel en Suisse) ──────

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return `\uFEFF${body}\r\n`; // BOM : accents lisibles dans Excel
}

/** Export comptable des factures émises sur la période. */
export async function exportInvoicesCsvData(
  supabase: any, therapistId: string, period: ReportPeriod,
): Promise<string> {
  const { data, error } = await supabase
    .from("therapist_invoices")
    .select("numero_facture, date_emission, date_echeance, date_paiement, statut, client_nom, client_email, montant_ht, tva_taux, tva_montant, montant_remise, montant_total, montant_paye, currency, qr_reference")
    .eq("therapist_id", therapistId)
    .gte("date_emission", period.from)
    .lte("date_emission", period.to)
    .order("date_emission", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as any[])
    .filter((i) => !EXCLUDED_REPORT_STATUSES.includes(i.statut))
    .map((i) => [
      i.numero_facture, i.date_emission, i.date_echeance ?? "", i.date_paiement ?? "",
      i.statut, i.client_nom ?? "", i.client_email ?? "",
      Number(i.montant_ht ?? 0).toFixed(2),
      i.tva_taux === null ? "" : Number(i.tva_taux).toFixed(2),
      Number(i.tva_montant ?? 0).toFixed(2),
      Number(i.montant_remise ?? 0).toFixed(2),
      Number(i.montant_total ?? 0).toFixed(2),
      Number(i.montant_paye ?? 0).toFixed(2),
      round2(Number(i.montant_total ?? 0) - Number(i.montant_paye ?? 0)).toFixed(2),
      i.currency, i.qr_reference ?? "",
    ]);

  return toCsv(
    ["Numero", "Date emission", "Echeance", "Date paiement", "Statut", "Client", "Email",
      "Montant HT", "Taux TVA", "Montant TVA", "Remise", "Total TTC", "Encaisse", "Solde",
      "Devise", "Reference QR"],
    rows,
  );
}

/** Export des encaissements (paiements et remboursements) de la période. */
export async function exportPaymentsCsvData(
  supabase: any, therapistId: string, period: ReportPeriod,
): Promise<string> {
  const { data: invs } = await supabase
    .from("therapist_invoices")
    .select("id, numero_facture, client_nom, currency")
    .eq("therapist_id", therapistId);
  const byId = new Map(((invs ?? []) as any[]).map((i) => [i.id, i]));
  const ids = [...byId.keys()];
  if (ids.length === 0) return toCsv(["Date", "Facture", "Client", "Type", "Montant", "Devise", "Mode", "Reference"], []);

  const payments: any[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase
      .from("therapist_invoice_payments")
      .select("invoice_id, montant, date_paiement, mode_paiement, reference_bancaire, is_refund")
      .in("invoice_id", ids.slice(i, i + 100))
      .gte("date_paiement", period.from)
      .lte("date_paiement", period.to);
    payments.push(...((data ?? []) as any[]));
  }
  payments.sort((a, b) => String(a.date_paiement).localeCompare(String(b.date_paiement)));

  const rows = payments.map((p) => {
    const inv = byId.get(p.invoice_id);
    return [
      p.date_paiement, inv?.numero_facture ?? "", inv?.client_nom ?? "",
      p.is_refund ? "Remboursement" : "Encaissement",
      (p.is_refund ? -Number(p.montant ?? 0) : Number(p.montant ?? 0)).toFixed(2),
      inv?.currency ?? "CHF", p.mode_paiement ?? "", p.reference_bancaire ?? "",
    ];
  });

  return toCsv(["Date", "Facture", "Client", "Type", "Montant", "Devise", "Mode", "Reference"], rows);
}
