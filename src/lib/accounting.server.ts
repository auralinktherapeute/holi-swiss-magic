// Comptabilité thérapeute : agrégats, journaux, synthèse TVA et exports CSV.
// Tous les montants proviennent des données réellement enregistrées
// (snapshots des lignes émises et paiements), jamais d'un calcul du front-end.

import { round2 } from "@/lib/swiss-invoice";
import { toCsv } from "@/lib/invoice-report.server";

/** Statuts comptant dans le chiffre d'affaires facturé. */
export const REVENUE_STATUSES = [
  "validee", "envoyee", "consultee", "partiellement_payee", "payee", "en_retard", "en_litige",
];

export const FIDUCIARY_NOTICE =
  "Ce récapitulatif facilite la préparation comptable. Vérifiez les montants avec votre fiduciaire avant toute déclaration officielle.";

export const PACK_NOTICE =
  "Ce pack est destiné à faciliter la transmission à votre comptable ou fiduciaire. Il ne remplace pas une validation comptable ou fiscale professionnelle.";

export type Period = { from: string; to: string };

export type AccountingData = {
  period: Period;
  overview: {
    revenue_invoiced: number;
    collected: number;
    outstanding: number;
    overdue_count: number;
    overdue_amount: number;
    cancelled_count: number;
    cancelled_amount: number;
    total_ht: number;
    total_vat: number;
    total_ttc: number;
    vat_by_rate: { rate: number; base: number; vat: number; ttc: number }[];
  };
  invoices: any[];
  payments: any[];
  lines: any[];
};

function clientName(inv: any) {
  return inv.client_nom || (inv.metadata?.client_name ?? "") || "—";
}

export async function buildAccounting(
  supabase: any, therapistId: string, period: Period,
): Promise<AccountingData> {
  const [invRes, payRes] = await Promise.all([
    supabase
      .from("therapist_invoices")
      .select("id,numero_facture,statut,client_id,client_nom,client_adresse,client_npa,client_ville," +
        "montant_ht,tva_montant,montant_total,montant_paye,currency,date_emission,date_echeance," +
        "date_paiement,langue,reference_type,qr_reference,credit_note_of_id,metadata")
      .eq("therapist_id", therapistId)
      .gte("date_emission", period.from)
      .lte("date_emission", period.to)
      .order("date_emission", { ascending: true })
      .limit(3000),
    supabase
      .from("therapist_invoice_payments")
      .select("id,invoice_id,montant,date_paiement,mode_paiement,reference_bancaire,notes,is_refund,created_by")
      .eq("therapist_id", therapistId)
      .gte("date_paiement", period.from)
      .lte("date_paiement", period.to)
      .order("date_paiement", { ascending: true })
      .limit(5000),
  ]);

  const invoices = ((invRes.data ?? []) as any[]).map((i) => ({
    ...i,
    montant_ht: Number(i.montant_ht ?? 0),
    tva_montant: Number(i.tva_montant ?? 0),
    montant_total: Number(i.montant_total ?? 0),
    montant_paye: Number(i.montant_paye ?? 0),
    solde: round2(Number(i.montant_total ?? 0) - Number(i.montant_paye ?? 0)),
    client_name: clientName(i),
    type: i.credit_note_of_id || i.statut === "avoir" ? "avoir" : "facture",
  }));

  const ids = invoices.map((i) => i.id);
  let lines: any[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("therapist_invoice_lines")
      .select("invoice_id,position,description,date_prestation,quantite,prix_unitaire,remise_pct," +
        "tva_taux,montant_ht,tva_montant,montant_ttc,tariff_code,tariff_label,tariff_version,unite,duree_min")
      .in("invoice_id", ids)
      .order("position", { ascending: true })
      .limit(20000);
    lines = (data ?? []) as any[];
  }

  const byNumber = new Map(invoices.map((i) => [i.id, i]));
  const payments = ((payRes.data ?? []) as any[]).map((p) => {
    const inv = byNumber.get(p.invoice_id);
    return {
      ...p,
      montant: Number(p.montant ?? 0) * (p.is_refund ? -1 : 1),
      numero_facture: inv?.numero_facture ?? "—",
      client_name: inv?.client_name ?? "—",
      currency: inv?.currency ?? "CHF",
      qr_reference: inv?.qr_reference ?? null,
    };
  });

  const counted = invoices.filter((i) => REVENUE_STATUSES.includes(i.statut));
  const cancelled = invoices.filter((i) => i.statut === "annulee");
  const credits = invoices.filter((i) => i.type === "avoir");
  const overdue = invoices.filter((i) => i.statut === "en_retard" && i.solde > 0);

  const vatMap = new Map<number, { rate: number; base: number; vat: number; ttc: number }>();
  const countedIds = new Set(counted.map((i) => i.id));
  for (const l of lines) {
    if (!countedIds.has(l.invoice_id)) continue;
    const rate = Number(l.tva_taux ?? 0);
    const cur = vatMap.get(rate) ?? { rate, base: 0, vat: 0, ttc: 0 };
    cur.base = round2(cur.base + Number(l.montant_ht ?? 0));
    cur.vat = round2(cur.vat + Number(l.tva_montant ?? 0));
    cur.ttc = round2(cur.ttc + Number(l.montant_ttc ?? 0));
    vatMap.set(rate, cur);
  }

  const sum = (arr: any[], key: string) => round2(arr.reduce((s, x) => s + Number(x[key] ?? 0), 0));

  return {
    period,
    overview: {
      revenue_invoiced: round2(sum(counted, "montant_total") - sum(credits, "montant_total")),
      collected: round2(payments.reduce((s, p) => s + p.montant, 0)),
      outstanding: round2(counted.reduce((s, i) => s + Math.max(i.solde, 0), 0)),
      overdue_count: overdue.length,
      overdue_amount: round2(overdue.reduce((s, i) => s + i.solde, 0)),
      cancelled_count: cancelled.length,
      cancelled_amount: sum(cancelled, "montant_total"),
      total_ht: sum(counted, "montant_ht"),
      total_vat: sum(counted, "tva_montant"),
      total_ttc: sum(counted, "montant_total"),
      vat_by_rate: [...vatMap.values()].sort((a, b) => a.rate - b.rate),
    },
    invoices,
    payments,
    lines,
  };
}

/** CSV UTF-8 avec BOM pour une ouverture correcte dans Excel. */
export function withBom(csv: string): string {
  return `\uFEFF${csv}`;
}

export function invoicesCsv(d: AccountingData): string {
  return withBom(toCsv(
    ["Numéro", "Type", "Date", "Échéance", "Client", "Adresse", "Statut", "Devise",
      "Total HT", "TVA", "Total TTC", "Encaissé", "Solde", "Langue", "Référence", "Identifiant"],
    d.invoices.map((i) => [
      i.numero_facture, i.type, i.date_emission, i.date_echeance ?? "", i.client_name,
      [i.client_adresse, i.client_npa, i.client_ville].filter(Boolean).join(", "),
      i.statut, i.currency, i.montant_ht, i.tva_montant, i.montant_total,
      i.montant_paye, i.solde, i.langue ?? "", i.qr_reference ?? "", i.id,
    ]),
  ));
}

export function linesCsv(d: AccountingData): string {
  const byId = new Map(d.invoices.map((i) => [i.id, i]));
  return withBom(toCsv(
    ["Numéro facture", "Date", "Client", "Date prestation", "Code tarifaire", "Libellé",
      "Quantité", "Unité", "Durée (min)", "Prix HT", "Taux TVA", "Montant TVA", "Total TTC", "Version tarif"],
    d.lines.map((l) => {
      const i = byId.get(l.invoice_id);
      return [
        i?.numero_facture ?? "", i?.date_emission ?? "", i?.client_name ?? "",
        l.date_prestation ?? "", l.tariff_code ?? "", l.tariff_label || l.description,
        l.quantite, l.unite ?? "", l.duree_min ?? "", l.montant_ht, l.tva_taux,
        l.tva_montant, l.montant_ttc, l.tariff_version ?? "",
      ];
    }),
  ));
}

export function paymentsCsv(d: AccountingData): string {
  return withBom(toCsv(
    ["Date", "Numéro facture", "Client", "Montant", "Devise", "Mode de paiement",
      "Référence", "Note", "Utilisateur", "Identifiant paiement"],
    d.payments.map((p) => [
      p.date_paiement, p.numero_facture, p.client_name, p.montant, p.currency,
      p.mode_paiement ?? "", p.reference_bancaire ?? "", p.notes ?? "", p.created_by ?? "", p.id,
    ]),
  ));
}

export function vatCsv(d: AccountingData): string {
  const period = `${d.period.from} → ${d.period.to}`;
  return withBom(toCsv(
    ["Taux TVA", "Base HT", "TVA collectée", "Total TTC", "Période"],
    d.overview.vat_by_rate.map((v) => [v.rate, v.base, v.vat, v.ttc, period]),
  ));
}

/** Résumé de période au format HTML imprimable (converti en PDF par le navigateur). */
export function summaryHtml(d: AccountingData, cabinet: string): string {
  const o = d.overview;
  const money = (n: number) => `${n.toFixed(2)} CHF`;
  const rows = o.vat_by_rate
    .map((v) => `<tr><td>${v.rate} %</td><td>${money(v.base)}</td><td>${money(v.vat)}</td><td>${money(v.ttc)}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Résumé comptable ${d.period.from} — ${d.period.to}</title>
<style>body{font-family:system-ui,sans-serif;margin:32px;color:#1a1a1a}
h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:12px}
th,td{border:1px solid #ddd;padding:6px 8px;text-align:left;font-size:13px}
.note{margin-top:24px;font-size:12px;color:#555;border-left:3px solid #999;padding-left:10px}</style>
</head><body>
<h1>Résumé comptable — ${cabinet}</h1>
<p>Période du ${d.period.from} au ${d.period.to}</p>
<table>
<tr><th>Chiffre d'affaires facturé</th><td>${money(o.revenue_invoiced)}</td></tr>
<tr><th>Montant encaissé</th><td>${money(o.collected)}</td></tr>
<tr><th>Solde restant</th><td>${money(o.outstanding)}</td></tr>
<tr><th>Factures en retard</th><td>${o.overdue_count} — ${money(o.overdue_amount)}</td></tr>
<tr><th>Factures annulées</th><td>${o.cancelled_count} — ${money(o.cancelled_amount)}</td></tr>
<tr><th>Total HT</th><td>${money(o.total_ht)}</td></tr>
<tr><th>TVA totale</th><td>${money(o.total_vat)}</td></tr>
<tr><th>Total TTC</th><td>${money(o.total_ttc)}</td></tr>
</table>
<h2 style="font-size:16px;margin-top:24px">TVA par taux</h2>
<table><tr><th>Taux</th><th>Base HT</th><th>TVA collectée</th><th>Total TTC</th></tr>${rows || "<tr><td colspan=4>Aucune TVA sur la période</td></tr>"}</table>
<p class="note">${FIDUCIARY_NOTICE}</p>
</body></html>`;
}
