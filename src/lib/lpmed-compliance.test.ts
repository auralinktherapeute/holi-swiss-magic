import { describe, it, expect } from "vitest";
import { assertNoHealthClaims, findForbiddenTerms } from "./lpmed-compliance";

/**
 * Verrou LPMéd pour les propositions marketing. Avant cette source unique,
 * seul le pipeline /marketing-daily (via l'agent marketing-qa, B5) vérifiait
 * la conformité santé — le chat Gemini de /admin/marketing (saveAnswerAsProposal)
 * et la création manuelle (createMarketingProposal) n'avaient AUCUN contrôle
 * déterministe. Ces tests figent le comportement attendu : détecter et
 * refuser, jamais corriger.
 */
describe("findForbiddenTerms", () => {
  it("détecte les termes interdits en français", () => {
    expect(findForbiddenTerms("Cette séance guérit l'anxiété.")).toContain("guérit");
    expect(findForbiddenTerms("Nous soignons les troubles du sommeil.")).toContain("soignons");
    expect(findForbiddenTerms("Un vrai traitement de fond.").length).toBeGreaterThan(0);
  });

  it("détecte les termes interdits en DE/IT/EN", () => {
    expect(findForbiddenTerms("Diese Sitzung heilt Angstzustände.").length).toBeGreaterThan(0);
    expect(findForbiddenTerms("Questa seduta guarisce l'ansia.").length).toBeGreaterThan(0);
    expect(findForbiddenTerms("This session heals anxiety.").length).toBeGreaterThan(0);
  });

  it("ne signale rien sur un texte conforme", () => {
    expect(findForbiddenTerms("Un accompagnement pour le bien-être et l'équilibre.")).toEqual([]);
    expect(findForbiddenTerms(null)).toEqual([]);
    expect(findForbiddenTerms(undefined)).toEqual([]);
  });
});

describe("assertNoHealthClaims", () => {
  it("lève une erreur nommant le champ fautif", () => {
    expect(() =>
      assertNoHealthClaims({ caption: "Cette approche guérit durablement.", angle: "ok" }),
    ).toThrow(/caption/);
  });

  it("n'altère jamais le texte — elle refuse, elle ne corrige pas", () => {
    const fields = { caption: "Cette approche soigne tout." };
    expect(() => assertNoHealthClaims(fields)).toThrow();
    expect(fields.caption).toBe("Cette approche soigne tout.");
  });

  it("passe silencieusement sur des champs conformes", () => {
    expect(() =>
      assertNoHealthClaims({
        caption: "Un accompagnement calme et structuré.",
        caption_en: "A calm, structured approach.",
        caption_de: "Ein ruhiger, strukturierter Ansatz.",
        caption_it: "Un approccio calmo e strutturato.",
        angle: undefined,
        visual_brief: null,
      }),
    ).not.toThrow();
  });
});
