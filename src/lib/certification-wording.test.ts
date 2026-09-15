import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { organizationNode } from "./organization-schema";
import { certificationTrustState } from "./certification-labels";

/**
 * Holiswiss valide les inscriptions MANUELLEMENT ; elle ne certifie pas les
 * praticiens. Aucun texte public ne doit donc généraliser « thérapeutes
 * certifiés » : la mention de certification est réservée aux justificatifs
 * réellement examinés, et l'inscription à un registre à un contrôle daté.
 */
const PUBLIC_TEXT_FILES = [
  "src/routes/$lang.index.tsx",
  "src/routes/$lang.therapeutes.index.tsx",
  "src/routes/$lang.specialites.$specialtySlug.index.tsx",
  "src/routes/$lang.specialites.$specialtySlug.$citySlug.tsx",
  "src/routes/$lang.therapeutes.canton.$canton.tsx",
  "src/routes/$lang.therapeutes.ville.$citySlug.tsx",
  "src/routes/__root.tsx",
  "src/lib/organization-schema.ts",
  "public/llms.txt",
  "src/routes/llms-full[.]txt.ts",
];

const FORBIDDEN = [
  /th[ée]rapeutes?\s+certifi[ée]s?/i,
  /praticiens?\s+certifi[ée]s?\s+dans/i,
  /certified\s+(holistic\s+)?therapists?/i,
  /zertifizierte\s+Therapeut/i,
  /terapeuti\s+certificati/i,
];

describe("terminologie des validations publiques", () => {
  for (const file of PUBLIC_TEXT_FILES) {
    it(`${file} ne généralise pas la certification`, () => {
      const text = readFileSync(file, "utf-8");
      for (const re of FORBIDDEN) expect(text).not.toMatch(re);
    });
  }

  it("le JSON-LD Organization parle de validation manuelle, pas de certification", () => {
    expect(organizationNode.description).toMatch(/validation manuelle/i);
    expect(organizationNode.description).not.toMatch(/certifi/i);
  });

  it("les 26 cantons restent une zone de recherche, pas une présence affirmée", () => {
    const llms = readFileSync("public/llms.txt", "utf-8");
    expect(llms).toMatch(/26 cantons/);
    expect(llms).toMatch(/recherche couvrant les/);
  });

  it("un justificatif déclaré reste déclaré ; seul un contrôle daté est confirmé", () => {
    expect(certificationTrustState({ verification_status: "pending" })).toBe("declared");
    expect(certificationTrustState({ verification_status: "verified" })).toBe("document_reviewed");
    expect(
      certificationTrustState({
        verification_status: "verified",
        registry_check_result: "confirmed",
        registry_checked_at: null,
      }),
    ).toBe("document_reviewed");
    expect(
      certificationTrustState({
        verification_status: "verified",
        registry_check_result: "confirmed",
        registry_checked_at: "2026-09-15T10:00:00Z",
      }),
    ).toBe("registry_confirmed");
  });
});
