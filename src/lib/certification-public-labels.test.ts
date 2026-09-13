import { describe, expect, it } from "vitest";
import { buildTrustBadges } from "./therapist-badges";

/**
 * Libellés exacts des états d'une certification sur la fiche publique.
 * Aucun état n'est jamais promu automatiquement.
 */
function certBadge(cert: Record<string, unknown>, lang = "fr") {
  return buildTrustBadges({ lang, certifications: [cert as any] }).find((b) => b.kind === "certification");
}

describe("libellés publics des certifications", () => {
  it("une certification simplement déclarée dit « Déclaré par le thérapeute »", () => {
    const b = certBadge({ name: "Massage classique", verification_status: "declared" });
    expect(b?.description).toContain("Déclaré par le thérapeute");
    expect(b?.description).not.toContain("Vérifié");
    expect(b?.verified).toBe(false);
  });

  it("une validation historique reste « Justificatif examiné par Holiswiss »", () => {
    const b = certBadge({
      name: "Réflexologie",
      verification_status: "verified",
      verified_at: "2025-03-04T10:00:00Z",
      registry_check_result: null,
      registry_checked_at: null,
    });
    expect(b?.description).toContain("Justificatif examiné par Holiswiss");
    expect(b?.description).not.toContain("registre");
  });

  it("une confirmation de registre affiche la date du contrôle réel", () => {
    const b = certBadge({
      name: "Réflexologie",
      verification_status: "verified",
      registry_check_result: "confirmed",
      registry_checked_at: "2026-09-10T08:30:00Z",
    });
    expect(b?.description).toContain("Inscription confirmée auprès du registre le 10.09.2026");
  });

  it("un résultat non concluant ne devient jamais une confirmation", () => {
    for (const result of ["not_found", "inconclusive"]) {
      const b = certBadge({
        name: "Réflexologie",
        verification_status: "verified",
        registry_check_result: result,
        registry_checked_at: "2026-09-10T08:30:00Z",
      });
      expect(b?.description).toContain("Justificatif examiné par Holiswiss");
      expect(b?.description).not.toContain("confirmée");
    }
  });

  it("une confirmation sans date ne s'affiche pas comme confirmée", () => {
    const b = certBadge({
      name: "Réflexologie",
      verification_status: "verified",
      registry_check_result: "confirmed",
      registry_checked_at: null,
    });
    expect(b?.description).toContain("Justificatif examiné par Holiswiss");
  });

  it("une certification expirée retombe au rang de déclaration", () => {
    const b = certBadge({
      name: "Réflexologie",
      verification_status: "verified",
      registry_check_result: "confirmed",
      registry_checked_at: "2026-09-10T08:30:00Z",
      expires_at: "2020-01-01T00:00:00Z",
    });
    expect(b?.description).toContain("Déclaré par le thérapeute");
    expect(b?.verified).toBe(false);
    expect(b?.verifiedAt).toBeNull();
  });

  it("les libellés suivent la langue de la fiche", () => {
    expect(certBadge({ name: "X", verification_status: "declared" }, "de")?.description).toContain(
      "Von der Therapeutin/dem Therapeuten angegeben",
    );
    expect(certBadge({ name: "X", verification_status: "verified" }, "it")?.description).toContain(
      "Documento esaminato da Holiswiss",
    );
    expect(
      certBadge(
        {
          name: "X",
          verification_status: "verified",
          registry_check_result: "confirmed",
          registry_checked_at: "2026-09-10T08:30:00Z",
        },
        "en",
      )?.description,
    ).toContain("Registry entry confirmed on");
  });
});
