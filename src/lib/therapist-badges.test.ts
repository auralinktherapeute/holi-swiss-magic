import { describe, it, expect } from "vitest";
import { buildTrustBadges, isProPlan } from "./therapist-badges";

const trainer = (over: Record<string, unknown> = {}) =>
  buildTrustBadges({
    lang: "fr",
    trainer: { isTrainer: true, subjects: "Naturopathie, phytothérapie", ...over },
  }).find((b) => b.kind === "trainer");

describe("badge Formateur", () => {
  it("n'apparaît pas si la case n'est pas cochée", () => {
    expect(trainer({ isTrainer: false })).toBeUndefined();
  });

  it("n'apparaît pas si les matières ne sont pas renseignées", () => {
    // La règle qui distingue la direction « Étayé » : cocher ne suffit pas.
    expect(trainer({ subjects: null })).toBeUndefined();
    expect(trainer({ subjects: "   " })).toBeUndefined();
  });

  it("apparaît dès que la case est cochée et les matières renseignées", () => {
    expect(trainer()?.label).toBe("Formateur");
  });

  it("porte l'année quand elle est fournie", () => {
    expect(trainer({ since: 2019 })?.label).toBe("Formateur · depuis 2019");
  });

  it("ignore une année non numérique sans perdre le badge", () => {
    expect(trainer({ since: Number.NaN })?.label).toBe("Formateur");
    expect(trainer({ since: null })?.label).toBe("Formateur");
  });

  it("n'est JAMAIS marqué comme vérifié", () => {
    // Holiswiss ne contrôle pas qui forme qui. Un badge déclaré et un badge
    // vérifié ne doivent jamais se ressembler — cette règle est le garde-fou.
    expect(trainer({ since: 2019, institution: "École de Sion" })?.verified).toBe(false);
  });

  it("dit explicitement que la mention n'est pas vérifiée", () => {
    expect(trainer()?.description).toContain("non vérifié par Holiswiss");
  });

  it("reprend les matières et l'établissement dans la description", () => {
    const b = trainer({ institution: "École de Naturopathie de Sion" });
    expect(b?.description).toContain("Naturopathie, phytothérapie");
    expect(b?.description).toContain("École de Naturopathie de Sion");
  });

  it("se traduit dans les quatre langues", () => {
    const label = (lang: string) =>
      buildTrustBadges({ lang, trainer: { isTrainer: true, subjects: "Yoga", since: 2020 } })
        .find((b) => b.kind === "trainer")?.label;
    expect(label("fr")).toBe("Formateur · depuis 2020");
    expect(label("de")).toBe("Ausbildner · seit 2020");
    expect(label("it")).toBe("Formatore · dal 2020");
    expect(label("en")).toBe("Trainer · since 2020");
  });

  it("arrive après les badges vérifiés", () => {
    const kinds = buildTrustBadges({
      lang: "fr",
      verified: true,
      subscriptionPlan: "pro",
      trainer: { isTrainer: true, subjects: "Yoga" },
    }).map((b) => b.kind);
    expect(kinds).toEqual(["pro", "verified", "trainer"]);
  });

  it("ne change rien quand aucune donnée formateur n'est fournie", () => {
    // Garde-fou de non-régression : les fiches existantes ne bougent pas.
    expect(buildTrustBadges({ lang: "fr", verified: true }).map((b) => b.kind)).toEqual(["verified"]);
  });
});

describe("isProPlan", () => {
  it("ne compte pas les plans gratuits", () => {
    for (const p of ["free", "basic", "none", "", null, undefined]) {
      expect(isProPlan(p as string | null)).toBe(false);
    }
  });
  it("compte tout plan payant", () => {
    for (const p of ["pro", "elite", "premium", "Elite Pro"]) expect(isProPlan(p)).toBe(true);
  });
});
