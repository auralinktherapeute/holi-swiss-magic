import { describe, it, expect } from "vitest";
import {
  isValidIban, isQrIban, buildQrReference, isValidQrReference,
  buildScorReference, isValidScorReference, validateReferenceForAccount,
  computeInvoiceTotals, missingInvoiceSettings, validateQrBill, creditorAccount,
} from "./swiss-invoice";

const IBAN = "CH9300762011623852957";        // IBAN CH standard (IID 00762)
const QRIBAN = "CH4431999123000889012";      // QR-IBAN (IID 31999)

describe("IBAN", () => {
  it("accepte un IBAN suisse valide", () => expect(isValidIban(IBAN)).toBe(true));
  it("accepte les espaces", () => expect(isValidIban("CH93 0076 2011 6238 5295 7")).toBe(true));
  it("refuse une clé de contrôle fausse", () => expect(isValidIban("CH9300762011623852958")).toBe(false));
  it("refuse une longueur incorrecte", () => expect(isValidIban("CH930076201162385")).toBe(false));
  it("refuse une saisie vide", () => expect(isValidIban("")).toBe(false));
});

describe("QR-IBAN", () => {
  it("détecte un QR-IBAN", () => expect(isQrIban(QRIBAN)).toBe(true));
  it("ne confond pas avec un IBAN normal", () => expect(isQrIban(IBAN)).toBe(false));
});

describe("Référence QRR", () => {
  it("génère 27 chiffres valides", () => {
    const ref = buildQrReference("2026000123");
    expect(ref).toHaveLength(27);
    expect(isValidQrReference(ref)).toBe(true);
  });
  it("refuse une clé altérée", () => {
    const ref = buildQrReference("2026000123");
    const bad = ref.slice(0, 26) + String((Number(ref[26]) + 1) % 10);
    expect(isValidQrReference(bad)).toBe(false);
  });
  it("refuse un format non numérique", () => expect(isValidQrReference("ABC")).toBe(false));
});

describe("Référence SCOR", () => {
  it("génère une référence RF valide", () => {
    const ref = buildScorReference("FACT2026001");
    expect(ref.startsWith("RF")).toBe(true);
    expect(isValidScorReference(ref)).toBe(true);
  });
  it("refuse une référence corrompue", () => expect(isValidScorReference("RF00XYZ")).toBe(false));
});

describe("Cohérence référence ↔ compte", () => {
  it("QRR exige un QR-IBAN", () => {
    expect(validateReferenceForAccount(IBAN, "qrr", buildQrReference("1"))).toMatch(/QR-IBAN/);
  });
  it("QRR acceptée avec un QR-IBAN", () => {
    expect(validateReferenceForAccount(QRIBAN, "qrr", buildQrReference("1"))).toBeNull();
  });
  it("un QR-IBAN refuse SCOR", () => {
    expect(validateReferenceForAccount(QRIBAN, "scor", buildScorReference("A"))).toMatch(/référence QR/);
  });
  it("IBAN normal + SCOR valide", () => {
    expect(validateReferenceForAccount(IBAN, "scor", buildScorReference("A"))).toBeNull();
  });
  it("IBAN normal + communication libre", () => {
    expect(validateReferenceForAccount(IBAN, "none", null)).toBeNull();
  });
  it("QR-IBAN sans référence est refusé", () => {
    expect(validateReferenceForAccount(QRIBAN, "none", null)).toMatch(/impose une référence QR/);
  });
});

describe("Calculs", () => {
  it("facture sans TVA", () => {
    const t = computeInvoiceTotals([{ description: "Séance", quantite: 2, prix_unitaire: 120 }]);
    expect(t.montant_ht).toBe(240);
    expect(t.tva_montant).toBe(0);
    expect(t.montant_total).toBe(240);
  });
  it("TVA 8,1 % en sus", () => {
    const t = computeInvoiceTotals([{ description: "x", quantite: 1, prix_unitaire: 100, tva_taux: 8.1 }]);
    expect(t.montant_ht).toBe(100);
    expect(t.tva_montant).toBe(8.1);
    expect(t.montant_total).toBe(108.1);
  });
  it("TVA 2,6 % incluse", () => {
    const t = computeInvoiceTotals([{ description: "x", quantite: 1, prix_unitaire: 102.6, tva_taux: 2.6 }], "inclusive");
    expect(t.montant_ht).toBe(100);
    expect(t.tva_montant).toBe(2.6);
    expect(t.montant_total).toBe(102.6);
  });
  it("plusieurs prestations avec taux différents", () => {
    const t = computeInvoiceTotals([
      { description: "a", quantite: 1, prix_unitaire: 100, tva_taux: 8.1 },
      { description: "b", quantite: 2, prix_unitaire: 50, tva_taux: 0 },
    ]);
    expect(t.montant_ht).toBe(200);
    expect(t.tva_montant).toBe(8.1);
    expect(t.tva_taux).toBeNull();
    expect(t.parTaux).toHaveLength(2);
  });
  it("remise de 10 %", () => {
    const t = computeInvoiceTotals([{ description: "x", quantite: 1, prix_unitaire: 200, remise_pct: 10 }]);
    expect(t.montant_ht).toBe(180);
    expect(t.montant_remise).toBe(20);
  });
});

describe("Complétude", () => {
  const ok = {
    iban_ou_qr_iban: IBAN, titulaire_nom: "Anna Test", adresse_rue: "Rue du Lac 1",
    adresse_npa: "1000", adresse_ville: "Lausanne", adresse_pays: "CH",
    devise_defaut: "CHF", assujetti_tva: false,
  };
  it("réglages complets", () => expect(missingInvoiceSettings(ok)).toEqual([]));
  it("réglages absents", () => expect(missingInvoiceSettings(null)).toHaveLength(1));
  it("IBAN invalide signalé", () => {
    expect(missingInvoiceSettings({ ...ok, iban_ou_qr_iban: "CH00" }).join()).toMatch(/IBAN/);
  });
  it("assujetti sans n° TVA", () => {
    expect(missingInvoiceSettings({ ...ok, assujetti_tva: true }).join()).toMatch(/TVA/);
  });
  it("QR-IBAN prioritaire", () => {
    expect(creditorAccount({ ...ok, qr_iban: QRIBAN })).toBe(QRIBAN);
  });
  it("données de paiement incomplètes bloquent la QR-facture", () => {
    const errs = validateQrBill({
      settings: ok, debtor: { client_nom: "Client" },
      amount: 0, currency: "CHF", referenceType: "none", reference: null,
    });
    expect(errs.length).toBeGreaterThan(0);
    expect(errs.join()).toMatch(/Adresse du destinataire/);
    expect(errs.join()).toMatch(/Montant/);
  });
  it("QR-facture conforme", () => {
    expect(validateQrBill({
      settings: ok,
      debtor: { client_nom: "Client", client_adresse: "Rue 2", client_npa: "1200", client_ville: "Genève" },
      amount: 108.1, currency: "CHF", referenceType: "none", reference: null,
    })).toEqual([]);
  });
});
