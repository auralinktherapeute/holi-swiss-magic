// Helpers purs pour la facturation suisse : validation IBAN / QR-IBAN,
// références QRR et SCOR, calculs HT / TVA / TTC.
// Aucune dépendance runtime : réutilisable serveur, client et tests.

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ── IBAN ────────────────────────────────────────────────────────────

export function normalizeIban(raw: string): string {
  return (raw ?? "").replace(/\s+/g, "").toUpperCase();
}

function mod97(input: string): number {
  let rem = 0;
  for (const ch of input) rem = (rem * 10 + Number(ch)) % 97;
  return rem;
}

/** Validation IBAN générique (longueur pays + chiffres de contrôle mod-97). */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) return false;
  const lengths: Record<string, number> = { CH: 21, LI: 21, FR: 27, DE: 22, IT: 27, AT: 20 };
  const expected = lengths[iban.slice(0, 2)];
  if (expected && iban.length !== expected) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}

/**
 * Un QR-IBAN est un IBAN CH/LI dont l'IID (positions 5 à 9) est compris
 * entre 30000 et 31999. Seul un QR-IBAN autorise une référence QRR.
 */
export function isQrIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  if (!isValidIban(iban)) return false;
  if (!/^(CH|LI)/.test(iban)) return false;
  const iid = Number(iban.slice(4, 9));
  return Number.isFinite(iid) && iid >= 30000 && iid <= 31999;
}

// ── Référence QRR (27 chiffres, modulo 10 récursif) ──────────────────

const MOD10_TABLE = [
  [0, 9, 4, 6, 8, 2, 7, 1, 3, 5],
  [9, 4, 6, 8, 2, 7, 1, 3, 5, 0],
  [4, 6, 8, 2, 7, 1, 3, 5, 0, 9],
  [6, 8, 2, 7, 1, 3, 5, 0, 9, 4],
  [8, 2, 7, 1, 3, 5, 0, 9, 4, 6],
  [2, 7, 1, 3, 5, 0, 9, 4, 6, 8],
  [7, 1, 3, 5, 0, 9, 4, 6, 8, 2],
  [1, 3, 5, 0, 9, 4, 6, 8, 2, 7],
  [3, 5, 0, 9, 4, 6, 8, 2, 7, 1],
  [5, 0, 9, 4, 6, 8, 2, 7, 1, 3],
];

export function mod10Recursive(digits: string): number {
  let carry = 0;
  for (const ch of digits) carry = MOD10_TABLE[carry]![Number(ch)]!;
  return (10 - carry) % 10;
}

/** Construit une QRR de 27 chiffres à partir d'une base numérique libre. */
export function buildQrReference(base: string): string {
  const digits = (base ?? "").replace(/\D/g, "").slice(-26).padStart(26, "0");
  return digits + String(mod10Recursive(digits));
}

export function isValidQrReference(raw: string): boolean {
  const ref = (raw ?? "").replace(/\s+/g, "");
  if (!/^\d{27}$/.test(ref)) return false;
  return mod10Recursive(ref.slice(0, 26)) === Number(ref[26]);
}

// ── Référence SCOR (RF, ISO 11649) ──────────────────────────────────

export function buildScorReference(base: string): string {
  const body = (base ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 21);
  const numeric = (body + "RF00").replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  const check = String(98 - mod97(numeric)).padStart(2, "0");
  return `RF${check}${body}`;
}

export function isValidScorReference(raw: string): boolean {
  const ref = (raw ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^RF\d{2}[0-9A-Z]{1,21}$/.test(ref)) return false;
  const rearranged = ref.slice(4) + ref.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  return mod97(numeric) === 1;
}

export type ReferenceType = "qrr" | "scor" | "none";

/** Cohérence référence ↔ type de compte, selon le standard SIX QR-facture. */
export function validateReferenceForAccount(
  account: string,
  type: ReferenceType,
  reference: string | null,
): string | null {
  const qr = isQrIban(account);
  if (type === "qrr") {
    if (!qr) return "Une référence QR (QRR) exige un QR-IBAN (IID 30000–31999).";
    if (!reference || !isValidQrReference(reference)) return "Référence QR invalide (27 chiffres + clé modulo 10).";
    return null;
  }
  if (type === "scor") {
    if (qr) return "Un QR-IBAN impose une référence QR, pas une référence SCOR.";
    if (!reference || !isValidScorReference(reference)) return "Référence SCOR invalide (format RF, ISO 11649).";
    return null;
  }
  if (qr) return "Un QR-IBAN impose une référence QR : sélectionnez le type QRR.";
  return null;
}

// ── Calculs ─────────────────────────────────────────────────────────

export type VatMode = "exclusive" | "inclusive";

export type InvoiceLineInput = {
  description: string;
  quantite: number;
  prix_unitaire: number;
  remise_pct?: number;
  tva_taux?: number;
  /** Champs de traçabilité conservés en snapshot sur la ligne émise. */
  date_prestation?: string | null;
  appointment_id?: string | null;
  tariff_system?: string | null;
  tariff_code?: string | null;
  tariff_label?: string | null;
  tariff_version?: string | null;
  unite?: string | null;
  duree_min?: number | null;
  commentaire?: string | null;
};


export type ComputedLine = InvoiceLineInput & {
  remise_pct: number;
  tva_taux: number;
  montant_ht: number;
  tva_montant: number;
  montant_ttc: number;
};

export type InvoiceTotals = {
  lines: ComputedLine[];
  montant_remise: number;
  montant_ht: number;
  tva_montant: number;
  montant_total: number;
  /** Taux unique si toutes les lignes partagent le même, sinon null. */
  tva_taux: number | null;
  parTaux: { taux: number; base: number; tva: number }[];
};

export function computeInvoiceTotals(
  lines: InvoiceLineInput[],
  mode: VatMode = "exclusive",
): InvoiceTotals {
  const computed: ComputedLine[] = lines.map((l) => {
    const qte = Number(l.quantite) || 0;
    const pu = Number(l.prix_unitaire) || 0;
    const remise = Math.min(Math.max(Number(l.remise_pct) || 0, 0), 100);
    const taux = Math.max(Number(l.tva_taux) || 0, 0);
    const base = round2(qte * pu * (1 - remise / 100));
    let ht: number, tva: number;
    if (mode === "inclusive") {
      ht = round2(base / (1 + taux / 100));
      tva = round2(base - ht);
    } else {
      ht = base;
      tva = round2(base * taux / 100);
    }
    return {
      ...l, remise_pct: remise, tva_taux: taux,
      montant_ht: ht, tva_montant: tva, montant_ttc: round2(ht + tva),
    };
  });

  const brut = round2(lines.reduce(
    (s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0), 0));
  const baseNette = round2(computed.reduce(
    (s, l) => s + (mode === "inclusive" ? l.montant_ttc : l.montant_ht), 0));
  const montant_remise = round2(brut - baseNette);

  const montant_ht = round2(computed.reduce((s, l) => s + l.montant_ht, 0));
  const tva_montant = round2(computed.reduce((s, l) => s + l.tva_montant, 0));

  const groups = new Map<number, { taux: number; base: number; tva: number }>();
  for (const l of computed) {
    const g = groups.get(l.tva_taux) ?? { taux: l.tva_taux, base: 0, tva: 0 };
    g.base = round2(g.base + l.montant_ht);
    g.tva = round2(g.tva + l.tva_montant);
    groups.set(l.tva_taux, g);
  }
  const parTaux = [...groups.values()].sort((a, b) => a.taux - b.taux);

  return {
    lines: computed,
    montant_remise: montant_remise > 0 ? montant_remise : 0,
    montant_ht,
    tva_montant,
    montant_total: round2(montant_ht + tva_montant),
    tva_taux: parTaux.length === 1 ? parTaux[0]!.taux : null,
    parTaux,
  };
}

// ── Complétude des réglages / de la QR-facture ──────────────────────

export type QrSettingsLike = {
  iban_ou_qr_iban?: string | null;
  qr_iban?: string | null;
  titulaire_nom?: string | null;
  raison_sociale?: string | null;
  adresse_rue?: string | null;
  adresse_npa?: string | null;
  adresse_ville?: string | null;
  adresse_pays?: string | null;
  devise_defaut?: string | null;
  assujetti_tva?: boolean | null;
  numero_tva?: string | null;
};

/** Compte créditeur effectif : le QR-IBAN prime s'il est renseigné. */
export function creditorAccount(s: QrSettingsLike): string {
  return normalizeIban(s.qr_iban || s.iban_ou_qr_iban || "");
}

/** Liste, en français, les champs manquants ou invalides. Vide = conforme. */
export function missingInvoiceSettings(s: QrSettingsLike | null | undefined): string[] {
  const out: string[] = [];
  if (!s) return ["Les réglages de facturation ne sont pas configurés."];
  const account = creditorAccount(s);
  if (!account) out.push("IBAN ou QR-IBAN du créancier");
  else if (!isValidIban(account)) out.push("IBAN invalide (chiffres de contrôle incorrects)");
  if (!(s.titulaire_nom || s.raison_sociale)) out.push("Titulaire du compte ou raison sociale");
  if (!s.adresse_rue) out.push("Adresse (rue)");
  if (!s.adresse_npa) out.push("NPA");
  if (!s.adresse_ville) out.push("Ville");
  if (!s.adresse_pays) out.push("Pays");
  if (!s.devise_defaut) out.push("Devise");
  if (s.assujetti_tva && !s.numero_tva) out.push("Numéro de TVA (obligatoire si assujetti)");
  return out;
}

export type DebtorLike = {
  client_nom?: string | null;
  client_adresse?: string | null;
  client_npa?: string | null;
  client_ville?: string | null;
  client_pays?: string | null;
};

export function missingDebtorFields(d: DebtorLike): string[] {
  const out: string[] = [];
  if (!d.client_nom) out.push("Nom du destinataire");
  if (!d.client_adresse) out.push("Adresse du destinataire");
  if (!d.client_npa) out.push("NPA du destinataire");
  if (!d.client_ville) out.push("Ville du destinataire");
  return out;
}

/** Contrôle complet avant génération d'une QR-facture. */
export function validateQrBill(args: {
  settings: QrSettingsLike | null | undefined;
  debtor: DebtorLike;
  amount: number;
  currency: string;
  referenceType: ReferenceType;
  reference: string | null;
}): string[] {
  const errors = [
    ...missingInvoiceSettings(args.settings),
    ...missingDebtorFields(args.debtor),
  ];
  if (!(Number(args.amount) > 0)) errors.push("Montant total supérieur à zéro");
  if (!["CHF", "EUR"].includes(args.currency)) errors.push("Devise : CHF ou EUR uniquement");
  if (args.settings) {
    const refErr = validateReferenceForAccount(
      creditorAccount(args.settings), args.referenceType, args.reference);
    if (refErr) errors.push(refErr);
  }
  return errors;
}

export const VAT_WARNING =
  "Vérifiez le taux applicable à votre activité avec votre fiduciaire ou l'Administration fédérale des contributions.";

export const INVOICE_STATUSES = [
  { id: "brouillon", label: "Brouillon" },
  { id: "validee", label: "Validée" },
  { id: "envoyee", label: "Envoyée" },
  { id: "consultee", label: "Consultée" },
  { id: "partiellement_payee", label: "Partiellement payée" },
  { id: "payee", label: "Payée" },
  { id: "en_retard", label: "En retard" },
  { id: "annulee", label: "Annulée" },
  { id: "avoir", label: "Avoir" },
  { id: "erreur_envoi", label: "Erreur d'envoi" },
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]["id"];
