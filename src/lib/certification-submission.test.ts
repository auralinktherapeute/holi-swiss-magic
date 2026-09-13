import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Garde-fous de sécurité sur la soumission d'un diplôme par un thérapeute :
 * le statut est imposé côté serveur et ne peut jamais venir du client.
 * (Le contrôle base de données correspondant vit dans
 * supabase/tests/rls_lot1_therapists_certifications.sql.)
 */
const src = readFileSync("src/lib/therapist-profile-extra.functions.ts", "utf8");
const addBlock = src.slice(src.indexOf("export const addCertification"), src.indexOf("export const deleteCertification"));

describe("addCertification", () => {
  it("impose le statut 'declared' à l'insertion", () => {
    expect(addBlock).toMatch(/verification_status:\s*"declared"/);
    expect(addBlock).toMatch(/verified_at:\s*null/);
    expect(addBlock).toMatch(/verified_by:\s*null/);
  });

  it("n'accepte aucun statut ni champ de vérification venant du client", () => {
    const validator = addBlock.slice(addBlock.indexOf(".inputValidator"), addBlock.indexOf(".handler"));
    for (const forbidden of ["verification_status", "verified_at", "verified_by", "status"]) {
      expect(validator).not.toMatch(new RegExp(`${forbidden}\\s*:`));
    }
  });

  it("conserve les champs optionnels pour rester compatible avec l'existant", () => {
    const validator = addBlock.slice(addBlock.indexOf(".inputValidator"), addBlock.indexOf(".handler"));
    for (const optional of ["credential_type", "registration_number", "holder_name", "expires_at", "issuer", "year"]) {
      expect(validator).toMatch(new RegExp(`${optional}[\\s\\S]{0,200}?optional\\(\\)`));
    }
  });

  it("renvoie le résultat de la pré-vérification et le statut au client", () => {
    expect(addBlock).toMatch(/return \{ ok: true, status: "declared" as const, autoCheck: check \}/);
  });
});
