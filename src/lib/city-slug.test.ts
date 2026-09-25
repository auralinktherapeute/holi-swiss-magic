import { describe, expect, it } from "vitest";
import { buildCitySlugResolver, cityToSlug, type CityRow } from "./city-slug";

// Extrait réel de la table `cities` en production (qqwud, 25/09/2026).
const ROWS: CityRow[] = [
  { slug: "basel", canonical_name: "Basel", aliases: ["basel", "bale", "basle", "basilea", "bs"] },
  { slug: "geneve", canonical_name: "Geneva", aliases: ["geneva", "geneve", "genève", "genf", "ginevra", "ge"] },
  { slug: "biel-bienne", canonical_name: "Biel/Bienne", aliases: ["biel", "bienne", "biel/bienne", "biel-bienne"] },
  { slug: "st-gallen", canonical_name: "St. Gallen", aliases: ["sankt gallen", "saint-gall", "san gallo"] },
  { slug: "carouge", canonical_name: "Carouge", aliases: ["carouge"] },
];

describe("buildCitySlugResolver", () => {
  const r = buildCitySlugResolver(ROWS);

  it("ramène alias et nom saisi au slug canonique de la table", () => {
    expect(r.tolerant("Bienne")).toBe("biel-bienne");
    expect(r.tolerant("bienne")).toBe("biel-bienne");
    expect(r.tolerant("Biel/Bienne")).toBe("biel-bienne");
    expect(r.tolerant("Genève")).toBe("geneve");
    expect(r.tolerant("ge")).toBe("geneve");
    expect(r.tolerant("geneva")).toBe("geneve");
    expect(r.tolerant("Bâle")).toBe("basel");
    expect(r.tolerant("San Gallo")).toBe("st-gallen");
  });

  it("un slug canonique se résout vers lui-même (pas de boucle de redirection)", () => {
    for (const row of ROWS) expect(r.tolerant(row.slug!)).toBe(row.slug);
  });

  it("ville absente de la table : slugification directe (tolérant) ou null (strict)", () => {
    expect(r.tolerant("Le Grand Saconnex")).toBe("le-grand-saconnex");
    expect(r.strict("Le Grand Saconnex")).toBeNull();
    expect(r.tolerant("acacias")).toBe("acacias");
    expect(r.strict("acacias")).toBeNull();
  });

  it("table vide ou illisible : repli sur cityToSlug", () => {
    const empty = buildCitySlugResolver(null);
    expect(empty.tolerant("Bienne")).toBe(cityToSlug("Bienne"));
    expect(empty.strict("Bienne")).toBeNull();
  });

  it("collision d'alias : la première ville lue l'emporte", () => {
    const rr = buildCitySlugResolver([
      { slug: "a", canonical_name: "A", aliases: ["x"] },
      { slug: "b", canonical_name: "B", aliases: ["x"] },
    ]);
    expect(rr.tolerant("x")).toBe("a");
  });

  it("lignes sans slug ignorées", () => {
    const rr = buildCitySlugResolver([{ slug: null, canonical_name: "Zug", aliases: ["zoug"] }]);
    expect(rr.strict("zoug")).toBeNull();
  });
});
