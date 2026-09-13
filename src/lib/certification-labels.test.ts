import { describe, expect, it } from "vitest";
import {
  CERTIFICATION_DECLARATION_TEXT,
  CERTIFICATION_RESPONSIBILITY_NOTICE,
  certificationStateLabel,
  certificationTrustState,
} from "./certification-labels";

describe("états de confiance d'une certification", () => {
  it("un dossier soumis reste « Déclaré par le thérapeute »", () => {
    const state = certificationTrustState({
      verification_status: "declared",
      registry_check_result: null,
      registry_checked_at: null,
    });
    expect(state).toBe("declared");
    expect(certificationStateLabel(state, { lang: "fr" })).toBe("Déclaré par le thérapeute");
  });

  it("une validation historique sans contrôle de registre reste « Justificatif examiné par Holiswiss »", () => {
    const state = certificationTrustState({
      verification_status: "verified",
      registry_check_result: null,
      registry_checked_at: null,
    });
    expect(state).toBe("document_reviewed");
    expect(certificationStateLabel(state, { lang: "fr" })).toBe("Justificatif examiné par Holiswiss");
  });

  it("un contrôle non concluant ou introuvable ne devient jamais une confirmation", () => {
    for (const r of ["not_found", "inconclusive"] as const) {
      expect(
        certificationTrustState({
          verification_status: "verified",
          registry_check_result: r,
          registry_checked_at: "2026-09-01",
        }),
      ).toBe("document_reviewed");
    }
  });

  it("seul un contrôle confirmé et daté donne la confirmation registre, avec la date", () => {
    const state = certificationTrustState({
      verification_status: "verified",
      registry_check_result: "confirmed",
      registry_checked_at: "2026-09-01T10:00:00.000Z",
    });
    expect(state).toBe("registry_confirmed");
    const label = certificationStateLabel(state, {
      registryCheckedAt: "2026-09-01T10:00:00.000Z",
      lang: "fr",
    });
    expect(label).toContain("Inscription confirmée auprès du registre le");
    expect(label).toContain("2026");
  });

  it("un statut refusé ou en attente d'informations n'est jamais confirmé", () => {
    for (const s of ["rejected", "needs_information"] as const) {
      expect(
        certificationTrustState({
          verification_status: s,
          registry_check_result: "confirmed",
          registry_checked_at: "2026-09-01",
        }),
      ).not.toBe("registry_confirmed");
    }
  });

  it("les textes obligatoires existent en FR/DE/IT/EN", () => {
    for (const l of ["fr", "de", "it", "en"] as const) {
      expect(CERTIFICATION_DECLARATION_TEXT[l].length).toBeGreaterThan(40);
      expect(CERTIFICATION_RESPONSIBILITY_NOTICE[l].length).toBeGreaterThan(80);
    }
    expect(CERTIFICATION_RESPONSIBILITY_NOTICE.fr).toContain("sous la responsabilité du thérapeute");
    expect(CERTIFICATION_DECLARATION_TEXT.fr).toContain("Je certifie");
  });
});
