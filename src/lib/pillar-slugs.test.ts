import { describe, it, expect } from "vitest";
import { PILLAR_SLUGS, isPillarSlug, mapPillarPath } from "./pillar-slugs";
import { PILLAR, PILLAR_LANGS } from "./visibility-pillar-content";

describe("mapping des slugs piliers", () => {
  it("reste la seule source de vérité pour le contenu éditorial", () => {
    for (const lang of PILLAR_LANGS) {
      expect(PILLAR[lang].slug).toBe(PILLAR_SLUGS[lang]);
    }
  });

  it("reconnaît les trois slugs et rien d'autre", () => {
    expect(isPillarSlug(PILLAR_SLUGS.fr)).toBe(true);
    expect(isPillarSlug(PILLAR_SLUGS.de)).toBe(true);
    expect(isPillarSlug(PILLAR_SLUGS.it)).toBe(true);
    expect(isPillarSlug("tarifs")).toBe(false);
    expect(isPillarSlug(undefined)).toBe(false);
  });

  it("mène à la bonne variante FR → DE → IT → FR", () => {
    expect(mapPillarPath("/fr/visibilite-therapeute-suisse", "de")).toBe(
      "/de/sichtbarkeit-therapeuten-schweiz",
    );
    expect(mapPillarPath("/de/sichtbarkeit-therapeuten-schweiz", "it")).toBe(
      "/it/visibilita-terapeuti-svizzera",
    );
    expect(mapPillarPath("/it/visibilita-terapeuti-svizzera", "fr")).toBe(
      "/fr/visibilite-therapeute-suisse",
    );
  });

  it("envoie l'anglais vers l'accueil, sans 404", () => {
    expect(mapPillarPath("/fr/visibilite-therapeute-suisse", "en")).toBe("/en");
    expect(mapPillarPath("/it/visibilita-terapeuti-svizzera", "en")).toBe("/en");
  });

  it("laisse les autres routes inchangées", () => {
    expect(mapPillarPath("/fr/tarifs", "de")).toBeNull();
    expect(mapPillarPath("/fr", "de")).toBeNull();
    expect(mapPillarPath("/fr/therapeute/jean", "de")).toBeNull();
    expect(mapPillarPath("/fr/visibilite-therapeute-suisse/extra", "de")).toBeNull();
  });
});

describe("FAQ : formulation validation", () => {
  it("dit qu'aucune validation n'est accordée automatiquement", () => {
    const joined = (lang: (typeof PILLAR_LANGS)[number]) =>
      PILLAR[lang].faq.map((f) => f.a).join(" ");
    expect(joined("fr")).toContain("Aucune validation n’est accordée automatiquement");
    expect(joined("de")).toContain("Keine Validierung wird automatisch gewährt");
    expect(joined("it")).toContain("Nessuna validazione è concessa automaticamente");
    expect(joined("fr")).not.toContain("Aucun état n’est attribué automatiquement");
  });
});
