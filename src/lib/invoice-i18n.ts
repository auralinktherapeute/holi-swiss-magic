// Libellés multilingues de la facture (FR / DE / IT / EN).
// Utilisé par le rendu HTML/PDF et par le bulletin QR-facture.

export const INVOICE_LANGS = ["fr", "de", "it", "en"] as const;
export type InvoiceLang = (typeof INVOICE_LANGS)[number];

export const INVOICE_LANG_LABELS: Record<InvoiceLang, string> = {
  fr: "Français", de: "Deutsch", it: "Italiano", en: "English",
};

export function normalizeInvoiceLang(v: unknown): InvoiceLang {
  const s = String(v ?? "fr").toLowerCase();
  return (INVOICE_LANGS as readonly string[]).includes(s) ? (s as InvoiceLang) : "fr";
}

/** Locale d'affichage des dates/nombres. */
export const INVOICE_LOCALE: Record<InvoiceLang, string> = {
  fr: "fr-CH", de: "de-CH", it: "it-CH", en: "en-CH",
};

/** Langue attendue par swissqrbill. */
export const QR_LANGUAGE: Record<InvoiceLang, "DE" | "FR" | "IT" | "EN"> = {
  fr: "FR", de: "DE", it: "IT", en: "EN",
};

type Dict = {
  invoice: string;
  issuedOn: string;
  serviceOn: string;
  dueDate: string;
  emitter: string;
  recipient: string;
  service: string;
  qty: string;
  unitPrice: string;
  discount: string;
  vat: string;
  amountExcl: string;
  noLines: string;
  totalDiscount: string;
  subtotal: string;
  totalToPay: string;
  totalToPayIncl: string;
  alreadyPaid: string;
  balance: string;
  paymentTerms: (days: string) => string;
  reference: string;
  vatOn: (rate: string, base: string) => string;
  print: string;
  footer: string;
  qrMissing: string;
  qrUnavailable: string;
  vatIncluded: string;
  vatExtra: string;
  notVatLiable: string;
  ide: string;
  vatNo: string;
  statuses: Record<string, string>;
};

const FR: Dict = {
  invoice: "Facture", issuedOn: "Émise le", serviceOn: "Prestation le", dueDate: "Échéance",
  emitter: "Émetteur", recipient: "Destinataire",
  service: "Prestation", qty: "Qté", unitPrice: "P.U.", discount: "Remise", vat: "TVA",
  amountExcl: "Montant HT", noLines: "Aucune ligne", totalDiscount: "Remise totale",
  subtotal: "Sous-total HT", totalToPay: "Total à payer", totalToPayIncl: "Total TTC à payer",
  alreadyPaid: "Déjà payé", balance: "Solde restant",
  paymentTerms: (d) => `Paiement à ${d} jours`, reference: "Référence",
  vatOn: (r, b) => `TVA ${r} % sur ${b}`,
  print: "Imprimer / Enregistrer en PDF", footer: "Document établi via HoliSwiss.",
  qrMissing: "QR-facture non générée — informations de paiement incomplètes :",
  qrUnavailable: "QR-facture indisponible",
  vatIncluded: "TVA incluse", vatExtra: "TVA en sus", notVatLiable: "Non assujetti à la TVA",
  ide: "IDE", vatNo: "TVA",
  statuses: {
    brouillon: "Brouillon", validee: "Validée", envoyee: "Envoyée", consultee: "Consultée",
    partiellement_payee: "Partiellement payée", payee: "Payée", en_retard: "En retard",
    en_litige: "En litige", annulee: "Annulée", avoir: "Avoir", erreur_envoi: "Erreur d'envoi",
  },
};

const DE: Dict = {
  invoice: "Rechnung", issuedOn: "Ausgestellt am", serviceOn: "Leistung am", dueDate: "Fällig am",
  emitter: "Rechnungssteller", recipient: "Empfänger",
  service: "Leistung", qty: "Menge", unitPrice: "Preis", discount: "Rabatt", vat: "MWST",
  amountExcl: "Betrag exkl.", noLines: "Keine Positionen", totalDiscount: "Rabatt total",
  subtotal: "Zwischentotal exkl.", totalToPay: "Zu zahlender Betrag", totalToPayIncl: "Total inkl. MWST",
  alreadyPaid: "Bereits bezahlt", balance: "Offener Betrag",
  paymentTerms: (d) => `Zahlbar innert ${d} Tagen`, reference: "Referenz",
  vatOn: (r, b) => `MWST ${r} % auf ${b}`,
  print: "Drucken / Als PDF speichern", footer: "Dokument erstellt mit HoliSwiss.",
  qrMissing: "QR-Rechnung nicht erstellt — Zahlungsangaben unvollständig:",
  qrUnavailable: "QR-Rechnung nicht verfügbar",
  vatIncluded: "MWST inbegriffen", vatExtra: "zzgl. MWST", notVatLiable: "Nicht MWST-pflichtig",
  ide: "UID", vatNo: "MWST-Nr.",
  statuses: {
    brouillon: "Entwurf", validee: "Freigegeben", envoyee: "Versendet", consultee: "Angesehen",
    partiellement_payee: "Teilweise bezahlt", payee: "Bezahlt", en_retard: "Überfällig",
    en_litige: "Strittig", annulee: "Storniert", avoir: "Gutschrift", erreur_envoi: "Versandfehler",
  },
};

const IT: Dict = {
  invoice: "Fattura", issuedOn: "Emessa il", serviceOn: "Prestazione del", dueDate: "Scadenza",
  emitter: "Emittente", recipient: "Destinatario",
  service: "Prestazione", qty: "Qtà", unitPrice: "Prezzo", discount: "Sconto", vat: "IVA",
  amountExcl: "Importo IVA escl.", noLines: "Nessuna riga", totalDiscount: "Sconto totale",
  subtotal: "Subtotale IVA escl.", totalToPay: "Totale da pagare", totalToPayIncl: "Totale IVA incl.",
  alreadyPaid: "Già pagato", balance: "Saldo residuo",
  paymentTerms: (d) => `Pagamento a ${d} giorni`, reference: "Riferimento",
  vatOn: (r, b) => `IVA ${r} % su ${b}`,
  print: "Stampa / Salva in PDF", footer: "Documento emesso con HoliSwiss.",
  qrMissing: "QR-fattura non generata — dati di pagamento incompleti:",
  qrUnavailable: "QR-fattura non disponibile",
  vatIncluded: "IVA inclusa", vatExtra: "IVA esclusa", notVatLiable: "Non assoggettato all'IVA",
  ide: "IDI", vatNo: "IVA",
  statuses: {
    brouillon: "Bozza", validee: "Convalidata", envoyee: "Inviata", consultee: "Consultata",
    partiellement_payee: "Parzialmente pagata", payee: "Pagata", en_retard: "In ritardo",
    en_litige: "In contestazione", annulee: "Annullata", avoir: "Nota di credito", erreur_envoi: "Errore d'invio",
  },
};

const EN: Dict = {
  invoice: "Invoice", issuedOn: "Issued on", serviceOn: "Service on", dueDate: "Due date",
  emitter: "Issuer", recipient: "Recipient",
  service: "Service", qty: "Qty", unitPrice: "Unit price", discount: "Discount", vat: "VAT",
  amountExcl: "Amount excl.", noLines: "No items", totalDiscount: "Total discount",
  subtotal: "Subtotal excl.", totalToPay: "Total due", totalToPayIncl: "Total incl. VAT",
  alreadyPaid: "Already paid", balance: "Outstanding balance",
  paymentTerms: (d) => `Payable within ${d} days`, reference: "Reference",
  vatOn: (r, b) => `VAT ${r}% on ${b}`,
  print: "Print / Save as PDF", footer: "Document issued via HoliSwiss.",
  qrMissing: "QR-bill not generated — payment details incomplete:",
  qrUnavailable: "QR-bill unavailable",
  vatIncluded: "VAT included", vatExtra: "plus VAT", notVatLiable: "Not liable for VAT",
  ide: "UID", vatNo: "VAT no.",
  statuses: {
    brouillon: "Draft", validee: "Validated", envoyee: "Sent", consultee: "Viewed",
    partiellement_payee: "Partially paid", payee: "Paid", en_retard: "Overdue",
    en_litige: "Disputed", annulee: "Cancelled", avoir: "Credit note", erreur_envoi: "Sending error",
  },
};

const DICTS: Record<InvoiceLang, Dict> = { fr: FR, de: DE, it: IT, en: EN };

export function invoiceDict(lang: unknown): Dict {
  return DICTS[normalizeInvoiceLang(lang)];
}
