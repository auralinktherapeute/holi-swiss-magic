import { describe, it, expect } from "vitest";
import { assertNoHealthClaims, countForbiddenOccurrences, findForbiddenTerms } from "./lpmed-compliance";

/**
 * Verrou LPMéd pour les propositions marketing. Avant cette source unique,
 * seul le pipeline /marketing-daily (via l'agent marketing-qa, B5) vérifiait
 * la conformité santé — le chat Gemini de /admin/marketing (saveAnswerAsProposal),
 * la création manuelle (createMarketingProposal) et la régénération de
 * structure (regenerateProposalStructure) n'avaient AUCUN contrôle
 * déterministe. Ces tests figent le comportement attendu : détecter et
 * refuser, jamais corriger.
 *
 * L'audit vibeflow-validator du 2026-10-02b a trouvé 3 bugs dans la v1 de ce
 * module — les groupes de tests ci-dessous correspondent chacun à l'un
 * d'eux et doivent rester verts pour qu'ils ne reviennent pas.
 */
describe("findForbiddenTerms", () => {
  it("détecte les termes interdits en français, conjugaisons courantes", () => {
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

  // Bug 1 (audit 2026-10-02b) : `\b` ne pose pas de frontière après une
  // lettre accentuée en JS — « soigné »/« traité » ne matchaient jamais.
  describe("formes accentuées en fin de mot (régression bug 1)", () => {
    it("détecte les participes passés accentués", () => {
      expect(findForbiddenTerms("Vous serez soigné.")).toContain("soigné");
      expect(findForbiddenTerms("Votre stress est traité.")).toContain("traité");
      expect(findForbiddenTerms("Elle est guérie.")).toContain("guérie");
    });

    it("ne les manque pas en fin de phrase ni devant une virgule", () => {
      expect(findForbiddenTerms("soigné,").length).toBeGreaterThan(0);
      expect(findForbiddenTerms("traité).").length).toBeGreaterThan(0);
    });
  });

  // Bug 2 (audit 2026-10-02b) : faux positifs sur les disclaimers légaux
  // réels déjà en prod (marketing-carousels.ts:277 et ses traductions) et
  // sur les idiomes de bien-être génériques.
  describe("négations et idiomes sûrs (régression bug 2)", () => {
    it("n'alerte pas sur le disclaimer légal réel (FR/DE/IT/EN)", () => {
      expect(
        findForbiddenTerms(
          "Aucune promesse de guérison. Ce point n'est pas négociable.",
        ),
      ).toEqual([]);
      expect(findForbiddenTerms("Keine Heilversprechen.")).toEqual([]);
      expect(findForbiddenTerms("Nessuna promessa di guarigione.")).toEqual([]);
      expect(findForbiddenTerms("No healing claims.")).toEqual([]);
    });

    it("n'alerte pas sur une négation explicite", () => {
      expect(findForbiddenTerms("Nous ne soignons pas.")).toEqual([]);
      expect(findForbiddenTerms("Ce n'est pas un traitement médical.")).toEqual([]);
    });

    it("n'alerte pas sur les idiomes de bien-être génériques", () => {
      expect(findForbiddenTerms("Prendre soin de soi, chaque semaine.")).toEqual([]);
      expect(findForbiddenTerms("Un moment de soin de soi.")).toEqual([]);
      expect(findForbiddenTerms("Un rituel de cura di sé.")).toEqual([]);
    });

    it("continue d'alerter quand l'allégation n'est PAS niée", () => {
      // Ces phrases contiennent le même vocabulaire mais sans négation ni
      // idiome protecteur juste avant — elles doivent rester détectées.
      expect(findForbiddenTerms("Cette méthode guérit vraiment.").length).toBeGreaterThan(0);
      expect(findForbiddenTerms("Nous soignons efficacement.").length).toBeGreaterThan(0);
    });
  });

  // Bug N4 (audit 2026-10-02c) : la fenêtre de négation générique (bug 2,
  // v1) canceled une allégation réelle dès qu'un mot de négation quelconque
  // traînait à proximité, SANS lien grammatical avec le terme. Remplacée
  // par des motifs exacts dont le terme interdit fait partie intégrante —
  // ces 4 phrases, données par l'audit comme passant à tort, doivent
  // maintenant être détectées.
  describe("allégations réelles à proximité d'un mot de négation sans rapport (régression N4)", () => {
    it("détecte une allégation même si une négation sans rapport est proche", () => {
      expect(
        findForbiddenTerms("Sans médicaments, notre méthode guérit l'anxiété.").length,
      ).toBeGreaterThan(0);
      expect(
        findForbiddenTerms("Une approche non médicamenteuse qui soigne en profondeur.").length,
      ).toBeGreaterThan(0);
      expect(findForbiddenTerms("Not just relaxation, it heals anxiety.").length).toBeGreaterThan(0);
      expect(
        findForbiddenTerms("Prendre soin de soi : cette séance soigne l'anxiété.").length,
      ).toBeGreaterThan(0);
    });

    it("l'idiome sûr ne blanchit que ce qu'il contient réellement, pas toute la phrase", () => {
      // "Prendre soin de soi" doit rester blanc, mais le "soigne" séparé
      // plus loin dans la même phrase doit être détecté.
      const terms = findForbiddenTerms("Prendre soin de soi : cette séance soigne l'anxiété.");
      expect(terms).toContain("soigne");
    });
  });

  // Bug N5 (audit 2026-10-02c) : la fenêtre de négation scannait un simple
  // « ne » isolé par `\b`, qui matchait à tort la fin de mots accentués
  // comme « hygiène », « gêne », « scène » (même bug de frontière que le
  // bug 1, reporté dans un nouvel endroit). Plus de scan de mot de négation
  // isolé désormais — ces phrases doivent être détectées normalement.
  describe("mots accentués finissant en -ène ne sont plus pris pour une négation (régression N5)", () => {
    it("détecte l'allégation malgré un mot en -ène juste avant", () => {
      expect(findForbiddenTerms("Une hygiène de vie qui soigne.").length).toBeGreaterThan(0);
      expect(findForbiddenTerms("Sans gêne, cette méthode guérit.").length).toBeGreaterThan(0);
    });
  });
});

// Bug 3 (audit 2026-10-02b) : countForbidden (article-clean) comparait des
// comptes dédupliqués AVANT/APRÈS réécriture — un mot déjà présent qui se
// répète n'était plus détecté comme une dégradation.
describe("countForbiddenOccurrences (régression bug 3 — comptage non dédupliqué)", () => {
  it("compte chaque occurrence, pas chaque terme distinct", () => {
    expect(countForbiddenOccurrences("guérit, guérit, guérit")).toBe(3);
    expect(findForbiddenTerms("guérit, guérit, guérit")).toEqual(["guérit"]);
  });

  it("détecte qu'une réécriture a réintroduit un terme déjà présent", () => {
    const before = "Cette approche guérit.";
    const after = "Cette approche guérit vraiment, elle guérit.";
    expect(countForbiddenOccurrences(after)).toBeGreaterThan(countForbiddenOccurrences(before));
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

  it("passe sur le vrai disclaimer légal de marketing-carousels.ts", () => {
    expect(() =>
      assertNoHealthClaims({
        caption:
          "Nous vérifions la formation, la reconnaissance (RME ou ASCA — à jour, pas expirée), " +
          "les informations sur la séance et la langue du profil. Aucune promesse de guérison. " +
          "Ce point n'est pas négociable.",
      }),
    ).not.toThrow();
  });
});
