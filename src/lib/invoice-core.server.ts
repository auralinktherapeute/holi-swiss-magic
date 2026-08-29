// Logique serveur de la facturation thérapeute : accès, audit, recalculs.
// Séparé des server functions pour garder celles-ci minces.

import {
  computeInvoiceTotals, validateQrBill, creditorAccount,
  type InvoiceLineInput, type ReferenceType, type VatMode, round2,
} from "@/lib/swiss-invoice";

export async function getTherapistId(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Profil thérapeute introuvable.");
  return data.id as string;
}

export async function logInvoiceAudit(
  supabase: any,
  args: {
    therapistId: string; invoiceId: string | null; action: string;
    actorUserId: string; before?: unknown; after?: unknown; note?: string | null;
  },
) {
  await supabase.from("therapist_invoice_audit").insert({
    therapist_id: args.therapistId,
    invoice_id: args.invoiceId,
    action: args.action,
    actor_user_id: args.actorUserId,
    before_data: args.before ?? null,
    after_data: args.after ?? null,
    note: args.note ?? null,
  });
}

export async function loadOwnInvoice(supabase: any, therapistId: string, id: string) {
  const { data, error } = await supabase
    .from("therapist_invoices").select("*")
    .eq("id", id).eq("therapist_id", therapistId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Facture introuvable.");
  return data;
}

export async function loadSettings(supabase: any, therapistId: string) {
  const { data } = await supabase
    .from("therapist_invoice_settings").select("*")
    .eq("therapist_id", therapistId).maybeSingle();
  return data ?? null;
}

export async function loadLines(supabase: any, invoiceId: string) {
  const { data } = await supabase
    .from("therapist_invoice_lines").select("*")
    .eq("invoice_id", invoiceId).order("position", { ascending: true });
  return (data ?? []) as any[];
}

/** Recalcule serveur les montants d'une facture brouillon à partir de ses lignes. */
export async function recomputeInvoice(
  supabase: any, therapistId: string, invoiceId: string, mode: VatMode,
) {
  const lines = await loadLines(supabase, invoiceId);
  const totals = computeInvoiceTotals(
    lines.map((l) => ({
      description: l.description, quantite: Number(l.quantite),
      prix_unitaire: Number(l.prix_unitaire), remise_pct: Number(l.remise_pct),
      tva_taux: Number(l.tva_taux),
    })) as InvoiceLineInput[],
    mode,
  );
  const { error } = await supabase.from("therapist_invoices").update({
    montant_ht: totals.montant_ht,
    tva_montant: totals.tva_montant,
    tva_taux: totals.tva_taux,
    montant_remise: totals.montant_remise,
    montant_total: totals.montant_total,
  }).eq("id", invoiceId).eq("therapist_id", therapistId);
  if (error) throw new Error(error.message);
  return totals;
}

/** Remplace les lignes d'un brouillon et renvoie les totaux recalculés. */
export async function replaceLines(
  supabase: any, therapistId: string, invoiceId: string,
  lines: InvoiceLineInput[], mode: VatMode,
) {
  const totals = computeInvoiceTotals(lines, mode);
  await supabase.from("therapist_invoice_lines").delete().eq("invoice_id", invoiceId);
  if (totals.lines.length) {
    const rows = totals.lines.map((l, i) => ({
      invoice_id: invoiceId, therapist_id: therapistId, position: i,
      description: l.description, quantite: l.quantite, prix_unitaire: l.prix_unitaire,
      remise_pct: l.remise_pct, tva_taux: l.tva_taux,
      montant_ht: l.montant_ht, tva_montant: l.tva_montant, montant_ttc: l.montant_ttc,
    }));
    const { error } = await supabase.from("therapist_invoice_lines").insert(rows);
    if (error) throw new Error(error.message);
  }
  const { error: e2 } = await supabase.from("therapist_invoices").update({
    montant_ht: totals.montant_ht,
    tva_montant: totals.tva_montant,
    tva_taux: totals.tva_taux,
    montant_remise: totals.montant_remise,
    montant_total: totals.montant_total,
  }).eq("id", invoiceId).eq("therapist_id", therapistId);
  if (e2) throw new Error(e2.message);
  return totals;
}

/** Liste des blocages avant validation / génération de la QR-facture. */
export async function invoiceReadiness(supabase: any, therapistId: string, invoiceId: string) {
  const [invoice, settings, lines] = await Promise.all([
    loadOwnInvoice(supabase, therapistId, invoiceId),
    loadSettings(supabase, therapistId),
    loadLines(supabase, invoiceId),
  ]);
  const errors = validateQrBill({
    settings,
    debtor: invoice,
    amount: Number(invoice.montant_total),
    currency: invoice.currency,
    referenceType: (invoice.reference_type ?? "none") as ReferenceType,
    reference: invoice.qr_reference ?? null,
  });
  if (!lines.length) errors.unshift("Au moins une ligne de prestation");
  return { errors, invoice, settings, lines, account: settings ? creditorAccount(settings) : "" };
}

/** Solde et statut de paiement dérivés des encaissements réels. */
export async function refreshPaymentState(supabase: any, therapistId: string, invoiceId: string) {
  const invoice = await loadOwnInvoice(supabase, therapistId, invoiceId);
  const { data: payments } = await supabase
    .from("therapist_invoice_payments").select("montant, is_refund, date_paiement")
    .eq("invoice_id", invoiceId);
  const paid = round2((payments ?? []).reduce(
    (s: number, p: any) => s + (p.is_refund ? -Number(p.montant) : Number(p.montant)), 0));
  const total = round2(Number(invoice.montant_total));

  let statut: string = invoice.statut;
  // Statuts « figés » : ils ne sont pas recalculés depuis les encaissements,
  // sauf si la facture est intégralement payée (le paiement clôt le litige).
  const frozen = ["annulee", "avoir", "en_litige"];
  const fullyPaid = total > 0 && paid + 0.01 >= total;
  if (!frozen.includes(invoice.statut) || (invoice.statut === "en_litige" && fullyPaid)) {
    if (paid <= 0) {
      const overdue = invoice.date_echeance && new Date(invoice.date_echeance) < new Date();
      statut = invoice.locked_at ? (overdue ? "en_retard" : (invoice.sent_at ? "envoyee" : "validee")) : "brouillon";
    } else if (!fullyPaid) statut = "partiellement_payee";
    else statut = "payee";
  }

  const patch: Record<string, unknown> = {
    montant_paye: paid,
    statut,
    statut_paiement: statut === "payee" ? "payee"
      : statut === "annulee" ? "annulee"
      : statut === "en_retard" ? "en_retard" : "en_attente",
    date_paiement: statut === "payee"
      ? (payments ?? []).map((p: any) => p.date_paiement).sort().slice(-1)[0] ?? new Date().toISOString()
      : null,
  };

  await supabase.from("therapist_invoices").update(patch)
    .eq("id", invoiceId).eq("therapist_id", therapistId);
  return { paid, solde: round2(total - paid), statut };
}
