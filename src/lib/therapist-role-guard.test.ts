import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Régression P0 — un compte « avis » (session authentifiée sans preuve
 * thérapeute) ne doit jamais recevoir le rôle therapist en ouvrant
 * /dashboard, tandis qu'un vrai thérapeute éligible reste réparé.
 *
 * Les fonctions serveur ne sont pas exécutables telles quelles dans vitest
 * (middleware d'authentification) : les tests vérifient le contrat du code
 * source, comme billing-mobile.test.ts.
 */

const dashboard = readFileSync("src/routes/dashboard.tsx", "utf8");
const serverFn = readFileSync("src/lib/auth-role.functions.ts", "utf8");
const connexion = readFileSync("src/routes/$lang.connexion.index.tsx", "utf8");
const inscription = readFileSync("src/routes/$lang.inscription.index.tsx", "utf8");

describe("garde du rôle thérapeute — comptes « avis »", () => {
  it("/dashboard n'appelle plus ensureTherapistRole sans preuve (requireProfile)", () => {
    expect(dashboard).not.toContain("ensureTherapistRole({ data: {} })");
    expect(dashboard).toContain("ensureTherapistRole({ data: { requireProfile: true } })");
  });

  it("/dashboard refuse l'accès et redirige vers la connexion après échec de réparation", () => {
    // Le bloc sans preuve se termine par une redirection, pas par un retour accordant l'accès.
    const denied = dashboard.slice(dashboard.indexOf("healedRole === \"admin\""));
    expect(denied).toContain('stage: "dashboard_denied"');
    expect(denied).toMatch(/throw redirect\(\{ to: "\/\$lang\/connexion"/);
    expect(denied).not.toMatch(/if \(granted\) return;/);
  });

  it("la fonction serveur exige une preuve avant d'attribuer le rôle en mode réparation", () => {
    const guard = serverFn.slice(
      serverFn.indexOf("if (data.requireProfile) {"),
      serverFn.indexOf("from(\"user_roles\")\n      .upsert"),
    );
    // Trois preuves acceptées : profil existant, intention d'inscription, fiche importée.
    expect(guard).toContain(".from(\"therapists\")");
    expect(guard).toContain('meta.signup_intent === "therapist"');
    expect(guard).toContain(".ilike(\"email\", email)");
    // Et sans preuve : refus explicite, aucune attribution.
    expect(guard).toContain('return { role: "user", granted: false };');
  });

  it("la connexion utilise le mode réparation avec preuve, jamais l'attribution libre", () => {
    expect(connexion).toContain("ensureRole({ data: { requireProfile: true } })");
    expect(connexion).not.toContain("ensureRole({ data: {} })");
  });

  it("l'inscription thérapeute explicite conserve l'attribution du rôle", () => {
    expect(inscription).toContain("ensureRole({ data: {} })");
    expect(inscription).toContain('signup_intent: "therapist"');
  });
});
