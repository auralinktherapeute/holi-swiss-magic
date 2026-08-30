import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getTherapistId, logInvoiceAudit, loadOwnInvoice, refreshPaymentState } from "@/lib/invoice-core.server";
import { parseCamt054, normalizeReference } from "@/lib/camt054";

export type ReconciliationMatch = {
  reference: string | null;
  bankRef: string | null;
  debtor: string | null;
  amount: number;
  currency: string;
  date: string | null;
  status: "matched" | "amount_mismatch" | "already_paid" | "unmatched" | "ignored";
  invoice: {
    id: string;
    numero_facture: string;
    montant_total: number;
    montant_paye: number;
    solde: number;
    statut: string;
    currency: string;
  } | null;
  message: string;
};

/** Analyse un fichier camt.054 et propose un rapprochement (aucune écriture). */
export const analyzeCamtFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    xml: z.string().min(20, "Fichier vide").max(4_000_000, "Fichier trop volumineux (max 4 Mo)"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const { entries, errors } = parseCamt054(data.xml);

    const { data: invoices, error } = await (context.supabase as any)
      .from("therapist_invoices")
      .select("id, numero_facture, qr_reference, montant_total, montant_paye, statut, currency")
      .eq("therapist_id", therapistId)
      .not("numero_facture", "is", null);
    if (error) throw new Error(error.message);

    const byRef = new Map<string, any>();
    for (const inv of invoices ?? []) {
      const ref = normalizeReference(inv.qr_reference);
      if (ref) byRef.set(ref, inv);
      const num = String(inv.numero_facture ?? "").replace(/\s+/g, "").toUpperCase();
      if (num) byRef.set(num, inv);
      // Référence QRR sans zéros non significatifs
      if (ref) byRef.set(ref.replace(/^0+/, ""), inv);
    }

    const matches: ReconciliationMatch[] = entries.map((e) => {
      if (!e.credit) {
        return { reference: e.reference, bankRef: e.bankRef, debtor: e.debtor, amount: e.amount,
          currency: e.currency, date: e.date, status: "ignored", invoice: null,
          message: "Écriture au débit, ignorée." };
      }
      const key = e.reference ?? "";
      const inv = byRef.get(key) ?? byRef.get(key.replace(/^0+/, ""));
      if (!inv) {
        return { reference: e.reference, bankRef: e.bankRef, debtor: e.debtor, amount: e.amount,
          currency: e.currency, date: e.date, status: "unmatched", invoice: null,
          message: "Aucune facture correspondante pour cette référence." };
      }
      const solde = Number(inv.montant_total ?? 0) - Number(inv.montant_paye ?? 0);
      const info = {
        id: inv.id as string,
        numero_facture: String(inv.numero_facture),
        montant_total: Number(inv.montant_total ?? 0),
        montant_paye: Number(inv.montant_paye ?? 0),
        solde: Math.round(solde * 100) / 100,
        statut: String(inv.statut ?? ""),
        currency: String(inv.currency ?? "CHF"),
      };
      if (solde <= 0.005) {
        return { reference: e.reference, bankRef: e.bankRef, debtor: e.debtor, amount: e.amount,
          currency: e.currency, date: e.date, status: "already_paid", invoice: info,
          message: `Facture ${info.numero_facture} déjà soldée.` };
      }
      const diff = Math.abs(solde - e.amount);
      return {
        reference: e.reference, bankRef: e.bankRef, debtor: e.debtor, amount: e.amount,
        currency: e.currency, date: e.date,
        status: diff <= 0.005 ? "matched" : "amount_mismatch",
        invoice: info,
        message: diff <= 0.005
          ? `Correspond au solde de la facture ${info.numero_facture}.`
          : `Montant reçu ${e.amount.toFixed(2)} ≠ solde ${info.solde.toFixed(2)} (paiement partiel ou trop-perçu).`,
      };
    });

    return { matches, errors, total: entries.length };
  });

/** Enregistre les encaissements validés par le thérapeute (une ligne par facture). */
export const applyCamtPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    items: z.array(z.object({
      invoice_id: z.string().uuid(),
      montant: z.number().positive(),
      date_paiement: z.string().trim().min(4).nullable().optional(),
      reference_bancaire: z.string().trim().max(140).nullable().optional(),
    })).min(1).max(200),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const therapistId = await getTherapistId(context.supabase, context.userId);
    const results: Array<{ invoice_id: string; ok: boolean; message: string }> = [];

    for (const item of data.items) {
      try {
        await loadOwnInvoice(context.supabase, therapistId, item.invoice_id);
        const ref = item.reference_bancaire ?? null;
        if (ref) {
          const { data: dup } = await (context.supabase as any)
            .from("therapist_invoice_payments")
            .select("id")
            .eq("therapist_id", therapistId)
            .eq("invoice_id", item.invoice_id)
            .eq("reference_bancaire", ref)
            .limit(1);
          if (dup && dup.length > 0) {
            results.push({ invoice_id: item.invoice_id, ok: false, message: "Encaissement déjà enregistré (même référence bancaire)." });
            continue;
          }
        }
        const { error } = await (context.supabase as any).from("therapist_invoice_payments").insert({
          invoice_id: item.invoice_id,
          therapist_id: therapistId,
          montant: item.montant,
          date_paiement: item.date_paiement || new Date().toISOString().slice(0, 10),
          mode_paiement: "virement",
          reference_bancaire: ref,
          is_refund: false,
          notes: "Rapprochement bancaire camt.054",
          created_by: context.userId,
        });
        if (error) throw new Error(error.message);
        const state = await refreshPaymentState(context.supabase, therapistId, item.invoice_id);
        await logInvoiceAudit(context.supabase, {
          therapistId, invoiceId: item.invoice_id, action: "payment_recorded",
          actorUserId: context.userId, after: { montant: item.montant, source: "camt054", ...state },
        });
        results.push({ invoice_id: item.invoice_id, ok: true, message: "Encaissement enregistré." });
      } catch (e: unknown) {
        results.push({ invoice_id: item.invoice_id, ok: false, message: e instanceof Error ? e.message : "Erreur" });
      }
    }

    return { results, applied: results.filter((r) => r.ok).length };
  });
