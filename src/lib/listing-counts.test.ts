import { describe, it, expect } from "vitest";
import {
  countTherapistsByCanton,
  countTherapistsByCity,
  countTherapistsByFamily,
  countTherapistsBySpecialty,
} from "./listing-counts";

/**
 * Les effectifs du sitemap doivent être ceux que la page AFFICHE. Chaque cas
 * ci-dessous reproduit un écart réel ou plausible entre les deux lectures.
 */
const CITIES = [
  { slug: "geneve", canonical_name: "Geneva", aliases: ["ge", "genève"] },
  { slug: "biel-bienne", canonical_name: "Biel/Bienne", aliases: ["bienne", "biel"] },
];

describe("countTherapistsByCity — même lecture que listTherapistsByCity", () => {
  it("regroupe les alias sous le slug canonique", () => {
    const m = countTherapistsByCity(
      [
        { id: "1", slug: "a", city: "Genève", canton: "GE" },
        { id: "2", slug: "b", city: "Geneve", canton: "GE" },
        { id: "3", slug: "c", city: "Bienne", canton: "BE" },
      ],
      CITIES,
    );
    expect(m.get("geneve")).toBe(2);
    expect(m.get("biel-bienne")).toBe(1);
  });

  it("ne compte ni les fiches sans slug, ni sans ville, ni inactives", () => {
    const m = countTherapistsByCity(
      [
        { id: "1", slug: null, city: "Genève", canton: "GE" },
        { id: "2", slug: "b", city: null, canton: "GE" },
        { id: "3", slug: "c", city: "Genève", canton: "GE", status: "pending" },
        { id: "4", slug: "d", city: "Genève", canton: "GE", status: "active" },
      ],
      CITIES,
    );
    expect(m.get("geneve")).toBe(1);
  });

  it("garde une ville absente de `cities` sous sa slugification (page servie en 200)", () => {
    const m = countTherapistsByCity([{ id: "1", slug: "a", city: "Le Grand Saconnex", canton: "GE" }], CITIES);
    expect(m.get("le-grand-saconnex")).toBe(1);
  });
});

describe("countTherapistsByCanton — même lecture que listTherapistsByCanton", () => {
  it("compte le code exact, en majuscules, connu de la route", () => {
    const m = countTherapistsByCanton([
      { id: "1", slug: "a", city: null, canton: "VD" },
      { id: "2", slug: "b", city: null, canton: "VD" },
      // `.eq("canton", "VD")` ne ramène pas « vd » : la page ne l'afficherait pas.
      { id: "3", slug: "c", city: null, canton: "vd" },
      { id: "4", slug: "d", city: null, canton: "XX" },
      { id: "5", slug: null, city: null, canton: "VD" },
    ]);
    expect(m.get("VD")).toBe(2);
    expect(m.has("vd")).toBe(false);
    expect(m.has("XX")).toBe(false);
  });
});

describe("countTherapistsBySpecialty / ByFamily — même lecture que getSpecialtyPage / getFamilyPage", () => {
  const active = new Set(["t1", "t2", "t3"]);
  const pivot = [
    { therapist_id: "t1", specialty_id: "reiki" },
    { therapist_id: "t2", specialty_id: "reiki" },
    { therapist_id: "t1", specialty_id: "magnetisme" },
    { therapist_id: "t9", specialty_id: "magnetisme" }, // inactif
    { therapist_id: "t3", specialty_id: "yoga" },
    { therapist_id: "t2", specialty_id: "ancienne" }, // spécialité inactive
  ];
  const specs = [
    { id: "reiki", family_id: "energie" },
    { id: "magnetisme", family_id: "energie" },
    { id: "yoga", family_id: "corps" },
  ];

  it("spécialité : praticiens actifs distincts, sans condition géographique", () => {
    const m = countTherapistsBySpecialty(pivot, active);
    expect(m.get("reiki")).toBe(2);
    expect(m.get("magnetisme")).toBe(1);
  });

  it("famille : un praticien présent dans deux spécialités compte une fois", () => {
    const m = countTherapistsByFamily(pivot, active, specs);
    expect(m.get("energie")).toBe(2); // t1 (reiki + magnétisme) et t2
    expect(m.get("corps")).toBe(1);
  });
});
