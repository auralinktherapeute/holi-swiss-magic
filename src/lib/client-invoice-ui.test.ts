import { describe, it, expect } from "vitest";
import {
  allowedActions, balance, clientInvoiceStats, displayNumber, matchesFilter, statusLabel,
  lineTotal, linesValid, settleReady, type InvoiceRow,
} from "./client-invoice-ui";

const inv = (p: Partial<InvoiceRow>): InvoiceRow => ({
  id: "x", numero_facture: "HS-2026-0001", statut: "validee", montant_total: 100, montant_paye: 0,
  currency: "CHF", date_emission: "2026-01-01", date_echeance: "2099-01-01", locked_at: "2026-01-01", ...p,
});
const draft = inv({ numero_facture: "BROUILLON-ABC", statut: "brouillon", locked_at: null });

describe("libellés et numéros", () => {
  it("affiche Brouillon pour un numéro provisoire", () => expect(displayNumber(draft)).toBe("Brouillon"));
  it("affiche le numéro définitif", () => expect(displayNumber(inv({}))).toBe("HS-2026-0001"));
  it("traduit les statuts existants", () => {
    expect(statusLabel("validee")).toBe("Émise");
    expect(statusLabel("partiellement_payee")).toBe("Partiellement payée");
  });
});

describe("actions permises", () => {
  it("brouillon sans paiement : modifier, valider, dupliquer, supprimer", () =>
    expect(allowedActions(draft, false)).toEqual(["edit", "validate", "duplicate", "delete"]));
  it("brouillon avec paiement : jamais supprimable", () =>
    expect(allowedActions(draft, true)).not.toContain("delete"));
  it("facture émise : ni modification ni suppression", () => {
    const a = allowedActions(inv({}), false);
    expect(a).not.toContain("edit");
    expect(a).not.toContain("delete");
    expect(a).toEqual(expect.arrayContaining(["pay", "send", "remind", "credit", "cancel", "duplicate"]));
  });
  it("facture payée : avoir possible, annulation et paiement non", () => {
    const a = allowedActions(inv({ statut: "payee", montant_paye: 100 }), true);
    expect(a).toContain("credit");
    expect(a).not.toContain("cancel");
    expect(a).not.toContain("pay");
    expect(a).not.toContain("delete");
  });
  it("facture annulée ou avoir : consultation et duplication seulement", () => {
    expect(allowedActions(inv({ statut: "annulee" }), false)).toEqual(["duplicate"]);
    expect(allowedActions(inv({ statut: "avoir", montant_total: -100 }), false)).toEqual(["duplicate"]);
  });
});

describe("paiements partiels et filtres", () => {
  const partial = inv({ statut: "partiellement_payee", montant_paye: 40 });
  it("solde après paiement partiel", () => expect(balance(partial)).toBe(60));
  it("filtre À encaisser", () => {
    expect(matchesFilter(partial, "a_encaisser")).toBe(true);
    expect(matchesFilter(draft, "a_encaisser")).toBe(false);
    expect(matchesFilter(inv({ statut: "payee", montant_paye: 100 }), "a_encaisser")).toBe(false);
  });
  it("filtre Annulées / Avoirs", () => {
    expect(matchesFilter(inv({ statut: "annulee" }), "annulees")).toBe(true);
    expect(matchesFilter(inv({ statut: "avoir" }), "annulees")).toBe(true);
    expect(matchesFilter(partial, "annulees")).toBe(false);
  });
});

describe("indicateurs de la fiche", () => {
  it("ignore brouillons et annulées, déduit les avoirs, compte les retards", () => {
    const s = clientInvoiceStats([
      draft,
      inv({ id: "a", montant_total: 100, montant_paye: 100, statut: "payee" }),
      inv({ id: "b", montant_total: 200, montant_paye: 50, statut: "partiellement_payee", date_echeance: "2000-01-01" }),
      inv({ id: "c", montant_total: 80, statut: "annulee" }),
      inv({ id: "d", montant_total: -30, statut: "avoir" }),
    ]);
    expect(s).toEqual({ facture: 270, encaisse: 150, solde: 150, retards: 1 });
  });
});

describe("saisie multi-lignes et encaissement", () => {
  it("total de ligne avec TVA", () => expect(lineTotal({ description: "a", quantite: 2, prix_unitaire: 50, tva_taux: 8.1 })).toBe(108.1));
  it("refuse une ligne sans description ou un total nul", () => {
    expect(linesValid([{ description: "", quantite: 1, prix_unitaire: 10, tva_taux: 0 }])).toBe(false);
    expect(linesValid([{ description: "a", quantite: 1, prix_unitaire: 0, tva_taux: 0 }])).toBe(false);
    expect(linesValid([
      { description: "Séance", quantite: 1, prix_unitaire: 120, tva_taux: 0 },
      { description: "Matériel", quantite: 2, prix_unitaire: 0, tva_taux: 0 },
    ])).toBe(true);
  });
  it("encaissement exige moyen, date valide et confirmation", () => {
    expect(settleReady("", "2026-10-07", true)).toBe(false);
    expect(settleReady("twint", "", true)).toBe(false);
    expect(settleReady("twint", "2026-10-07", false)).toBe(false);
    expect(settleReady("twint", "2026-10-07", true)).toBe(true);
  });
});
