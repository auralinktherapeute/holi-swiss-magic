// Règles pures de la facturation dans la fiche client (libellés, filtres, actions, totaux).
// Aucune écriture : sert l'affichage et les tests.

export type InvoiceRow = {
  id: string;
  numero_facture: string | null;
  statut: string;
  montant_total: number | string;
  montant_paye?: number | string | null;
  currency?: string | null;
  date_emission?: string | null;
  date_echeance?: string | null;
  locked_at?: string | null;
  sent_at?: string | null;
};

export type InvoiceFilter = "toutes" | "a_encaisser" | "payees" | "annulees";

const LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  validee: "Émise",
  envoyee: "Envoyée",
  consultee: "Consultée",
  partiellement_payee: "Partiellement payée",
  payee: "Payée",
  en_retard: "En retard",
  en_litige: "En litige",
  annulee: "Annulée",
  avoir: "Avoir",
  erreur_envoi: "Erreur d'envoi",
};

export function statusLabel(statut: string): string {
  return LABELS[statut] ?? statut;
}

export function isDraft(i: InvoiceRow): boolean {
  return i.statut === "brouillon" && !i.locked_at;
}

export function displayNumber(i: InvoiceRow): string {
  if (isDraft(i) || !i.numero_facture || i.numero_facture.startsWith("BROUILLON-")) return "Brouillon";
  return i.numero_facture;
}

export function balance(i: InvoiceRow): number {
  return Math.round((Number(i.montant_total) - Number(i.montant_paye ?? 0)) * 100) / 100;
}

const CLOSED = ["annulee", "avoir"];

export function matchesFilter(i: InvoiceRow, f: InvoiceFilter): boolean {
  if (f === "toutes") return true;
  if (f === "annulees") return CLOSED.includes(i.statut);
  if (f === "payees") return i.statut === "payee";
  return !isDraft(i) && !CLOSED.includes(i.statut) && balance(i) > 0;
}

export function clientInvoiceStats(rows: InvoiceRow[]) {
  const issued = rows.filter((i) => !isDraft(i) && !CLOSED.includes(i.statut));
  const credit = rows.filter((i) => i.statut === "avoir");
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const facture = r2(issued.reduce((s, i) => s + Number(i.montant_total), 0)
    + credit.reduce((s, i) => s + Number(i.montant_total), 0));
  const encaisse = r2(issued.reduce((s, i) => s + Number(i.montant_paye ?? 0), 0));
  const solde = r2(issued.reduce((s, i) => s + Math.max(0, balance(i)), 0));
  const today = new Date().toISOString().slice(0, 10);
  const retards = issued.filter((i) =>
    i.statut === "en_retard" || (balance(i) > 0 && !!i.date_echeance && i.date_echeance < today)).length;
  return { facture, encaisse, solde, retards };
}

export type InvoiceAction =
  | "edit" | "validate" | "delete" | "duplicate"
  | "pay" | "send" | "remind" | "cancel" | "credit";

/** Actions permises : un brouillon se modifie ; une facture émise se corrige par annulation ou avoir. */
export function allowedActions(i: InvoiceRow, hasPayments: boolean): InvoiceAction[] {
  if (isDraft(i)) {
    return hasPayments ? ["edit", "validate", "duplicate"] : ["edit", "validate", "duplicate", "delete"];
  }
  if (CLOSED.includes(i.statut)) return ["duplicate"];
  const out: InvoiceAction[] = ["duplicate"];
  if (balance(i) > 0) out.push("pay", "send", "remind");
  else out.push("send");
  out.push("credit");
  if (!hasPayments) out.push("cancel");
  return out;
}

export type DraftLine = { description: string; quantite: number; prix_unitaire: number; tva_taux: number };

export function lineTotal(l: DraftLine): number {
  const ht = l.quantite * l.prix_unitaire;
  return Math.round(ht * (1 + l.tva_taux / 100) * 100) / 100;
}

export function linesValid(lines: DraftLine[]): boolean {
  return lines.length > 0 && lines.every((l) =>
    l.description.trim().length > 0 && l.quantite > 0 && Number.isFinite(l.prix_unitaire)
    && l.prix_unitaire >= 0 && l.tva_taux >= 0 && l.tva_taux <= 100)
    && lines.some((l) => l.prix_unitaire * l.quantite > 0);
}

export function settleReady(mode: string | null, date: string | null, confirmed: boolean): boolean {
  return !!mode && !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && confirmed;
}
