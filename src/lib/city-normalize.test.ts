import { describe, expect, it } from "vitest";
import { auditTherapistCity } from "./city-audit";
import {
  communeDisplayName,
  normalizeCityInput,
  normalizePostalCode,
  resolveCity,
  validateTherapistLocation,
} from "./city-normalize";
import { getSwissNpaIndex } from "./swiss-npa";
import { cityToSlug } from "./city-slug";

// Référentiel RÉEL (swisstopo) : les tests échouent si une régénération du
// fichier change la réponse pour ces NPA — c'est voulu.
const idx = getSwissNpaIndex();
const codes = (a: ReturnType<typeof auditTherapistCity>) => a.issues.map((i) => i.code).sort();

describe("référentiel NPA", () => {
  it("contient les NPA attendus", () => {
    expect(idx.byNpa.get("1227")?.map((c) => c.name)).toEqual(["Carouge", "Genève", "Lancy"]);
    expect(idx.byNpa.get("4500")?.[0]).toMatchObject({ name: "Solothurn", canton: "SO" });
    expect(idx.byNpa.get("2502")?.[0]).toMatchObject({ name: "Biel/Bienne", canton: "BE" });
    expect(idx.byNpa.has("9999")).toBe(false);
  });

  it("retire le suffixe de canton des homonymes, et lui seul", () => {
    expect(communeDisplayName("Carouge (GE)", "GE")).toBe("Carouge");
    expect(communeDisplayName("Beinwil (Freiamt)", "AG")).toBe("Beinwil (Freiamt)");
  });
});

describe("normalizeCityInput", () => {
  it.each([
    ["Genève, Suisse", "Genève"],
    ["Zürich, Schweiz", "Zürich"],
    ["Lugano, Svizzera", "Lugano"],
    ["Geneva, Switzerland", "Geneva"],
    ["Lausanne (CH)", "Lausanne"],
    ["  Genève   ,  Suisse ", "Genève"],
    ["acacias", "Acacias"],
    ["le grand-saconnex", "Le Grand-Saconnex"],
    ["la chaux-de-fonds", "La Chaux-de-Fonds"],
    ["biel/bienne", "Biel/Bienne"],
    ["villars-sur-glâne", "Villars-sur-Glâne"],
    ["stein am rhein", "Stein am Rhein"],
    ["St. Gallen", "St. Gallen"],
    ["Rorschach", "Rorschach"],
    ["", ""],
  ])("%j → %j", (input, expected) => {
    expect(normalizeCityInput(input)).toBe(expected);
  });

  it("NPA : préfixe CH et espaces retirés", () => {
    expect(normalizePostalCode(" CH-1227 ")).toBe("1227");
    expect(normalizePostalCode("12 27")).toBe("1227");
  });
});

describe("resolveCity", () => {
  it("« acacias » + 1227 → localité, communes possibles", () => {
    const r = resolveCity(idx, "1227", "acacias");
    expect(r.kind).toBe("locality");
    if (r.kind === "locality") {
      expect(r.locality).toBe("Les Acacias");
      expect(r.communes.map((c) => c.name)).toEqual(["Carouge", "Genève", "Lancy"]);
    }
  });

  it("« Carouge » + 1227 → accepté tel quel", () => {
    const r = resolveCity(idx, "1227", "Carouge");
    expect(r).toMatchObject({ kind: "exact", commune: { name: "Carouge", canton: "GE" } });
  });

  it("« Bienne » + 2502 → variante de Biel/Bienne", () => {
    expect(resolveCity(idx, "2502", "Bienne")).toMatchObject({ kind: "variant", commune: { name: "Biel/Bienne" } });
  });

  it("« Basel » + 4500 → incohérent (4500 = Soleure), Basel trouvé ailleurs", () => {
    const r = resolveCity(idx, "4500", "Basel");
    expect(r.kind).toBe("mismatch");
    if (r.kind === "mismatch") {
      expect(r.candidates[0].name).toBe("Solothurn");
      expect(r.elsewhere.some((c) => c.name === "Basel" && c.canton === "BS")).toBe(true);
    }
  });
});

describe("validateTherapistLocation (enregistrement)", () => {
  it("« acacias » + 1227 → refusé, communes proposées", () => {
    const v = validateTherapistLocation(idx, { city: "acacias", postalCode: "1227", status: "active" });
    expect(v).toMatchObject({ ok: false, code: "city_is_locality", candidates: ["Carouge", "Genève", "Lancy"] });
  });

  it("« Carouge » + 1227 → accepté, canton GE déduit", () => {
    expect(validateTherapistLocation(idx, { city: "Carouge", postalCode: "1227", status: "active" }))
      .toEqual({ ok: true, city: "Carouge", postalCode: "1227", canton: "GE", changed: false });
  });

  it("« Genève, Suisse » + 1204 → « Genève »", () => {
    expect(validateTherapistLocation(idx, { city: "Genève, Suisse", postalCode: "1204" }))
      .toMatchObject({ ok: true, city: "Genève", canton: "GE", changed: true });
  });

  it("« geneve » + 1204 → normalisé en « Genève »", () => {
    expect(validateTherapistLocation(idx, { city: "geneve", postalCode: "1204" }))
      .toMatchObject({ ok: true, city: "Genève", canton: "GE" });
  });

  it("« Le Grand Saconnex » + 1218 → « Le Grand-Saconnex »", () => {
    expect(validateTherapistLocation(idx, { city: "Le Grand Saconnex", postalCode: "1218" }))
      .toMatchObject({ ok: true, city: "Le Grand-Saconnex" });
  });

  it("« Le Sentier » + 1347 → commune unique « Le Chenit » (VD)", () => {
    expect(validateTherapistLocation(idx, { city: "Le Sentier", postalCode: "1347" }))
      .toMatchObject({ ok: true, city: "Le Chenit", canton: "VD" });
  });

  it("« Basel » + 4500 → refusé", () => {
    expect(validateTherapistLocation(idx, { city: "Basel", postalCode: "4500" }))
      .toMatchObject({ ok: false, code: "city_npa_mismatch" });
  });

  it("ville vide sur fiche publiée → refusée", () => {
    expect(validateTherapistLocation(idx, { city: "", postalCode: "", status: "active" }))
      .toMatchObject({ ok: false, code: "city_required_active" });
    expect(validateTherapistLocation(idx, { city: "   ", postalCode: "1227", status: "active" }))
      .toMatchObject({ ok: false, code: "city_required_active" });
  });

  it("ville vide hors publication → acceptée (brouillon)", () => {
    expect(validateTherapistLocation(idx, { city: "", postalCode: "", status: "pending" }))
      .toMatchObject({ ok: true, city: "" });
  });

  it("NPA d'une seule commune + ville vide → commune déduite, même publiée", () => {
    expect(validateTherapistLocation(idx, { city: "", postalCode: "1004", status: "active" }))
      .toMatchObject({ ok: true, city: "Lausanne", canton: "VD" });
  });

  it("ville sans NPA → NPA exigé ; NPA inconnu ou mal formé → refusé", () => {
    expect(validateTherapistLocation(idx, { city: "Genève", postalCode: null }))
      .toMatchObject({ ok: false, code: "npa_required" });
    expect(validateTherapistLocation(idx, { city: "Genève", postalCode: "9999" }))
      .toMatchObject({ ok: false, code: "npa_unknown" });
    expect(validateTherapistLocation(idx, { city: "Genève", postalCode: "12A4" }))
      .toMatchObject({ ok: false, code: "npa_invalid" });
  });
});

describe("saint / st / sankt / san (cityKey)", () => {
  it("« St-Prex » + 1162 → Saint-Prex", () => {
    expect(validateTherapistLocation(idx, { city: "St-Prex", postalCode: "1162" })).toMatchObject({ ok: true, city: "Saint-Prex" });
  });
  it("« Saint-Moritz » + 7500 → St. Moritz", () => {
    expect(validateTherapistLocation(idx, { city: "Saint-Moritz", postalCode: "7500" })).toMatchObject({ ok: true, city: "St. Moritz" });
  });
  it("« St-Imier » + 2610 → Saint-Imier", () => {
    expect(validateTherapistLocation(idx, { city: "St-Imier", postalCode: "2610" })).toMatchObject({ ok: true, city: "Saint-Imier" });
  });
  it("« San Gallo » / « Sankt Gallen » + 9000 → St. Gallen", () => {
    expect(validateTherapistLocation(idx, { city: "San Gallo", postalCode: "9000" })).toMatchObject({ ok: true, city: "St. Gallen" });
    expect(validateTherapistLocation(idx, { city: "Sankt Gallen", postalCode: "9000" })).toMatchObject({ ok: true, city: "St. Gallen" });
  });
  it("pas de faux positif : Sion, Stein am Rhein, Santa Maria", () => {
    expect(validateTherapistLocation(idx, { city: "Sion", postalCode: "1950" })).toMatchObject({ ok: true, city: "Sion", changed: false });
    expect(validateTherapistLocation(idx, { city: "Stein am Rhein", postalCode: "8260" })).toMatchObject({ ok: true, city: "Stein am Rhein", changed: false });
    expect(validateTherapistLocation(idx, { city: "Santa Maria in Calanca", postalCode: "6541" })).toMatchObject({ ok: true, city: "Santa Maria in Calanca" });
    // « Sion » ne doit pas être accepté pour un NPA d'une commune « St-… »
    expect(validateTherapistLocation(idx, { city: "Sion", postalCode: "1162" })).toMatchObject({ ok: false, code: "city_npa_mismatch" });
  });
});

describe("fiche existante non modifiée (B1)", () => {
  it("ville/NPA inchangés et non conformes → pas de blocage, valeurs conservées telles quelles", () => {
    const v = validateTherapistLocation(idx, {
      city: "acacias", postalCode: "1227", status: "active", previous: { city: "acacias", postalCode: "1227" },
    });
    expect(v).toEqual({ ok: true, unchanged: true, changed: false, city: "acacias", postalCode: "1227", canton: null });
  });
  it("ville modifiée → validation complète", () => {
    expect(validateTherapistLocation(idx, {
      city: "Acacias", postalCode: "1227", status: "active", previous: { city: "acacias", postalCode: "1227" },
    })).toMatchObject({ ok: true, unchanged: true }); // même forme normalisée = inchangée
    expect(validateTherapistLocation(idx, {
      city: "Les Acacias", postalCode: "1227", status: "active", previous: { city: "acacias", postalCode: "1227" },
    })).toMatchObject({ ok: false, code: "city_is_locality" });
  });
  it("ville vide sur fiche publiée → toujours refusée, même inchangée", () => {
    expect(validateTherapistLocation(idx, {
      city: null, postalCode: null, status: "active", previous: { city: null, postalCode: null },
    })).toMatchObject({ ok: false, code: "city_required_active" });
  });
  it("les 11 fiches de production réenregistrées sans toucher à la localisation", () => {
    const prod: Array<[string | null, string | null]> = [
      ["Genève", null], ["Le Chenit", "1347"], [null, null], [null, null], ["Le Grand Saconnex", "1218"],
      ["Coppet", "1296"], ["acacias", "1227"], ["Basel", "4500"], ["Lausanne", "1004"], ["Bienne", "2502"], ["Payerne", "1530"],
    ];
    const got = prod.map(([city, postalCode]) => {
      const v = validateTherapistLocation(idx, { city, postalCode, status: "active", previous: { city, postalCode } });
      return v.ok ? "ok" : v.code;
    });
    expect(got).toEqual(["ok", "ok", "city_required_active", "city_required_active", "ok", "ok", "ok", "ok", "ok", "ok", "ok"]);
  });
});

describe("auditTherapistCity (admin)", () => {
  it("« acacias » / 1227 → signalé : localité + minuscules", () => {
    const a = auditTherapistCity(idx, { city: "acacias", postal_code: "1227", canton: "GE", status: "active" });
    expect(codes(a)).toEqual(["locality_not_commune", "lowercase_initial"]);
    expect(a.alternatives).toEqual(["Carouge", "Genève", "Lancy"]);
  });

  it("« Carouge » / 1227 / GE → aucun signalement", () => {
    expect(auditTherapistCity(idx, { city: "Carouge", postal_code: "1227", canton: "GE", status: "active" }).issues).toEqual([]);
  });

  it("« Genève, Suisse » / 1204 → suffixe pays seulement", () => {
    expect(codes(auditTherapistCity(idx, { city: "Genève, Suisse", postal_code: "1204", canton: "GE" }))).toEqual(["country_suffix"]);
  });

  it("« geneve » / 1204 → minuscules + forme non officielle, suggestion « Genève »", () => {
    const a = auditTherapistCity(idx, { city: "geneve", postal_code: "1204", canton: "GE" });
    expect(codes(a)).toEqual(["lowercase_initial", "not_official_form"]);
    expect(a.suggestion).toEqual({ city: "Genève", canton: "GE" });
  });

  it("ville vide sur fiche publiée → critique", () => {
    const a = auditTherapistCity(idx, { city: null, postal_code: null, canton: null, status: "active" });
    expect(a.issues.find((i) => i.code === "missing_city")?.severity).toBe("critical");
  });

  // Les 11 fiches actives relevées en production (qqwud, REST anon, 25/09/2026).
  it("fiches réelles de production", () => {
    const prod: Array<[string | null, string | null, string | null]> = [
      ["Genève", null, "GE"],
      ["Le Chenit", "1347", "VD"],
      [null, null, null],
      [null, null, null],
      ["Le Grand Saconnex", "1218", "GE"],
      ["Coppet", "1296", "VD"],
      ["acacias", "1227", "GE"],
      ["Basel", "4500", "BS"],
      ["Lausanne", "1004", "VD"],
      ["Bienne", "2502", "BE"],
      ["Payerne", "1530", "VD"],
    ];
    const got = prod.map(([city, postal_code, canton]) =>
      codes(auditTherapistCity(idx, { city, postal_code, canton, status: "active" })).join(","),
    );
    expect(got).toEqual([
      "missing_npa",
      "",
      "missing_city,missing_npa",
      "missing_city,missing_npa",
      "not_official_form",
      "",
      "locality_not_commune,lowercase_initial",
      "npa_mismatch",
      "",
      "not_official_form",
      "",
    ]);
  });
});

describe("impact sur les slugs (information, aucune donnée réécrite)", () => {
  it("les villes normalisées changent de slug", () => {
    expect([cityToSlug("Bienne"), cityToSlug("Biel/Bienne")]).toEqual(["bienne", "biel-bienne"]);
    expect([cityToSlug("Le Grand Saconnex"), cityToSlug("Le Grand-Saconnex")]).toEqual(["le-grand-saconnex", "le-grand-saconnex"]);
    expect([cityToSlug("acacias"), cityToSlug("Carouge")]).toEqual(["acacias", "carouge"]);
  });
});
