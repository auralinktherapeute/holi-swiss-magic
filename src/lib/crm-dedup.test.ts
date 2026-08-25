import { describe, expect, it } from "vitest";
import {
  detectDuplicateGroups,
  levenshtein,
  normEmail,
  normName,
  normPhone,
  type DedupCandidate,
} from "./crm-dedup";

function lead(p: Partial<DedupCandidate> & { id: string }): DedupCandidate {
  return {
    first_name: "Jean",
    last_name: "Test",
    email: null,
    phone: null,
    canton: null,
    specialty: null,
    source: "manual",
    status: "new",
    converted_therapist_id: null,
    created_at: "2026-01-01T00:00:00Z",
    dedup_status: "open",
    ...p,
  };
}

describe("normalisation", () => {
  it("normalise l'email", () => {
    expect(normEmail("  Chabal.M@PM.me ")).toBe("chabal.m@pm.me");
    expect(normEmail("")).toBeNull();
    expect(normEmail(null)).toBeNull();
  });

  it("normalise le téléphone suisse en format international", () => {
    expect(normPhone("+41 79 717 65 11")).toBe("41797176511");
    expect(normPhone("0797176511")).toBe("41797176511");
    expect(normPhone("079 717 65 11")).toBe("41797176511");
    expect(normPhone("—")).toBeNull();
  });

  it("normalise le nom sans casse ni accents", () => {
    expect(normName("Émilie", "Chardon")).toBe("emilie chardon");
    expect(normName("  ÉMILIE ", "Chardon-Roux")).toBe("emilie chardon roux");
  });

  it("calcule une distance de Levenshtein", () => {
    expect(levenshtein("larue", "larue")).toBe(0);
    expect(levenshtein("larue", "laruee")).toBe(1);
    expect(levenshtein("olivier", "gregory")).toBeGreaterThan(2);
  });
});

describe("détection de doublons", () => {
  it("détecte un doublon certain sur email (waitlist + inscription)", () => {
    const groups = detectDuplicateGroups([
      lead({ id: "a", email: "Chabal.M@pm.me", source: "inscription" }),
      lead({ id: "b", email: "chabal.m@pm.me ", source: "waitlist" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].level).toBe("certain");
    expect(groups[0].leadIds).toEqual(["a", "b"]);
  });

  it("détecte un doublon certain sur téléphone avec nom cohérent", () => {
    const groups = detectDuplicateGroups([
      lead({ id: "a", first_name: "Martine", last_name: "Chabal", phone: "+41797176511" }),
      lead({ id: "b", first_name: "Martine", last_name: "Chabal", phone: "079 717 65 11" }),
    ]);
    expect(groups[0].level).toBe("certain");
  });

  it("rétrograde en probable un téléphone partagé entre deux noms différents", () => {
    const groups = detectDuplicateGroups([
      lead({ id: "a", first_name: "Anne", last_name: "Dupont", phone: "0212223344" }),
      lead({ id: "b", first_name: "Marc", last_name: "Girard", phone: "+41212223344" }),
    ]);
    expect(groups[0].level).toBe("probable");
  });

  it("détecte un doublon probable sur nom + canton", () => {
    const groups = detectDuplicateGroups([
      lead({ id: "a", first_name: "Olivier", last_name: "Larue", canton: "GE" }),
      lead({ id: "b", first_name: "olivier", last_name: "larue", canton: "ge" }),
    ]);
    expect(groups[0].level).toBe("probable");
  });

  it("ne produit aucun faux positif sur deux personnes distinctes", () => {
    const groups = detectDuplicateGroups([
      lead({ id: "a", first_name: "Olivier", last_name: "Larue", email: "o@x.ch", canton: "GE" }),
      lead({ id: "b", first_name: "Gregory", last_name: "Arshakuni", email: "g@y.ch", canton: "VD" }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it("ignore les fiches déjà fusionnées", () => {
    const groups = detectDuplicateGroups([
      lead({ id: "a", email: "x@y.ch" }),
      lead({ id: "b", email: "x@y.ch", dedup_status: "merged" }),
    ]);
    expect(groups).toHaveLength(0);
  });

  it("classe un même profil thérapeute en certain", () => {
    const groups = detectDuplicateGroups([
      lead({ id: "a", converted_therapist_id: "t1", email: "a@a.ch" }),
      lead({ id: "b", converted_therapist_id: "t1", email: "b@b.ch" }),
    ]);
    expect(groups[0].level).toBe("certain");
    expect(groups[0].reason).toMatch(/profil thérapeute/i);
  });
});
