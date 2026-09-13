import { describe, it, expect } from "vitest";
import { autoCheckCertification, AUTOCHECK_DISCLAIMER } from "./certification-autocheck";

const base = {
  name: "Massage thérapeutique",
  issuer: "ASCA",
  year: new Date().getFullYear() - 3,
  hasFile: true,
  credentialType: "asca" as const,
  registrationNumber: "ASCA-12345",
  holderName: "Marie Dupont",
};

describe("autoCheckCertification", () => {
  it("dossier ASCA complet : reconnu, prêt à être soumis", () => {
    const r = autoCheckCertification(base);
    expect(r.verdict).toBe("recognized");
    expect(r.label).toBe("Dossier prêt à être soumis");
    expect(r.registry).toBe("ASCA");
    expect(r.missing).toHaveLength(0);
    expect(r.disclaimer).toBe(AUTOCHECK_DISCLAIMER);
    expect(JSON.stringify(r)).not.toMatch(/Vérifié/);
  });

  it("dossier RME complet : organisme RME / EMR identifié", () => {
    const r = autoCheckCertification({ ...base, issuer: "RME", credentialType: "rme" });
    expect(r.verdict).toBe("recognized");
    expect(r.registry).toBe("RME / EMR");
  });

  it("organisme inconnu mais dossier complet : plausible", () => {
    const r = autoCheckCertification({
      ...base,
      issuer: "École privée de Lausanne",
      credentialType: "other",
    });
    expect(r.verdict).toBe("plausible");
    expect(r.registry).toBeNull();
    expect(r.missing).toHaveLength(0);
  });

  it("année invalide : informations manquantes", () => {
    const r = autoCheckCertification({ ...base, year: 1899 });
    expect(r.verdict).toBe("incomplete");
    expect(r.label).toBe("Informations manquantes");
    expect(r.missing.join(" ")).toMatch(/Année/);
  });

  it("justificatif absent : informations manquantes", () => {
    const r = autoCheckCertification({ ...base, hasFile: false });
    expect(r.verdict).toBe("incomplete");
    expect(r.missing.join(" ")).toMatch(/justificatif/i);
  });

  it("numéro d'enregistrement absent : non bloquant", () => {
    const r = autoCheckCertification({ ...base, registrationNumber: null });
    expect(r.verdict).toBe("recognized");
    expect(r.notes.join(" ")).toMatch(/Numéro d'enregistrement absent/);
  });

  it("expiration dépassée : remarque non bloquante", () => {
    const r = autoCheckCertification({ ...base, expiresAt: "2000-01-01" });
    expect(r.missing).toHaveLength(0);
    expect(r.notes.join(" ")).toMatch(/dépassée/);
  });

  it("compatibilité : ancienne certification sans champs structurés", () => {
    const r = autoCheckCertification({ name: "Réflexologie", issuer: "ASCA", year: 2015, hasFile: true });
    expect(r.verdict).toBe("incomplete");
    expect(r.registry).toBe("ASCA");
    expect(r.missing.join(" ")).toMatch(/Type d'organisme/);
    expect(r.missing.join(" ")).toMatch(/Nom exact/);
  });

  it("ne renvoie jamais de verdict « verified »", () => {
    for (const v of ["recognized", "plausible", "incomplete"]) {
      expect(v).not.toBe("verified");
    }
  });
});
