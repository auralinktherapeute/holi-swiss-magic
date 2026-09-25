import { describe, expect, it } from "vitest";
import {
  computeListingFacts,
  countProfileLanguages,
  formatChfAmount,
  formatSwissDate,
  zurichDay,
} from "./directory-stats";

// Reproduit les cas réels observés sur qqwud le 25/09/2026 : fiches vides,
// price_min null ou 0, villes non normalisées, verified toujours false.
const ROWS = [
  {
    verified: false,
    price_min: 130,
    currency: "CHF",
    canton: "VD",
    city: "Payerne",
    languages: ["Français"],
  },
  {
    verified: false,
    price_min: 0,
    currency: "CHF",
    canton: "VD",
    city: "Lausanne",
    languages: ["Français", "English"],
  },
  {
    verified: false,
    price_min: null,
    currency: "CHF",
    canton: "GE",
    city: "Genève",
    languages: null,
  },
  {
    verified: false,
    price_min: 75,
    currency: "CHF",
    canton: "GE",
    city: "acacias",
    languages: ["Français"],
  },
  {
    verified: false,
    price_min: 60,
    currency: "CHF",
    canton: "BS",
    city: "Basel",
    languages: ["Français", "Deutsch", "English"],
  },
  { verified: false, price_min: null, currency: "CHF", canton: null, city: null, languages: null },
  {
    verified: false,
    price_min: 90,
    currency: "CHF",
    canton: "vd",
    city: "  lausanne ",
    languages: ["Italiano", "Klingon"],
  },
];

describe("computeListingFacts", () => {
  it("compte les fiches, exclut prix nuls/≤0 et normalise cantons/villes", () => {
    const f = computeListingFacts(ROWS);
    expect(f.count).toBe(7);
    expect(f.verifiedCount).toBe(0);
    expect(f.priceFrom).toBe(60);
    expect(f.pricedCount).toBe(4);
    expect(f.cantonCount).toBe(3); // VD, GE, BS
    expect(f.cityCount).toBe(5); // payerne, lausanne, genève, acacias, basel
  });

  it("regroupe les villes comme les pages ville (accents, casse, espaces)", () => {
    const f = computeListingFacts([{ city: "Genève" }, { city: "Geneve" }, { city: " GENÈVE " }]);
    expect(f.cityCount).toBe(1);
  });

  it("rend priceFrom null sans aucun prix valide", () => {
    const f = computeListingFacts([{ price_min: 0 }, { price_min: null }, { price_min: -5 }]);
    expect(f.priceFrom).toBeNull();
    expect(f.pricedCount).toBe(0);
  });

  it("ignore les prix dans une autre devise", () => {
    expect(computeListingFacts([{ price_min: 40, currency: "EUR" }]).priceFrom).toBeNull();
  });

  it("compte les fiches vérifiées quand il y en a", () => {
    expect(computeListingFacts([{ verified: true }, { verified: false }]).verifiedCount).toBe(1);
  });

  it("gère une liste vide", () => {
    expect(computeListingFacts([]).count).toBe(0);
  });
});

describe("countProfileLanguages", () => {
  it("compte par fiche les 4 langues connues, ignore les autres", () => {
    expect(countProfileLanguages(ROWS)).toEqual([
      { code: "fr", count: 4 },
      { code: "en", count: 2 },
      { code: "de", count: 1 },
      { code: "it", count: 1 },
    ]);
  });
});

describe("formats", () => {
  it("formate les montants en CHF à la suisse", () => {
    expect(formatChfAmount(90)).toBe("CHF 90");
    expect(formatChfAmount(1250)).toBe("CHF 1’250");
    expect(formatChfAmount(92.5)).toBe("CHF 92.50");
  });

  it("formate la date en JJ.MM.AAAA", () => {
    expect(formatSwissDate("2026-09-25")).toBe("25.09.2026");
    expect(formatSwissDate("n'importe quoi")).toBe("");
  });

  it("calcule le jour dans le fuseau de Zurich", () => {
    // 23:30 UTC le 24/09 = 01:30 le 25/09 à Zurich (heure d'été).
    expect(zurichDay(new Date("2026-09-24T23:30:00Z"))).toBe("2026-09-25");
  });
});
