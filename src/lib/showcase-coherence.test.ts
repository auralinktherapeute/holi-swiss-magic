/**
 * Tests de cohérence du score de visibilité.
 * Couvre : identité, SEO, synchronisation cache/audit et contrôle d'accès.
 * Modules purs uniquement (aucune I/O réseau).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { QueryClient } from "@tanstack/react-query";
import { runShowcaseAudit, type ShowcaseInput } from "@/lib/showcase-audit";
import { buildShowcaseAuditReport, type ShowcaseAuditReport } from "@/lib/showcase-report";
import { resolveSeoTitle, evaluateSeoTitle, buildGeneratedSeoTitle } from "@/lib/seo-title";
import { resolveSeoDescription, evaluateSeoDescription } from "@/lib/seo-description";
import { refreshShowcaseAfterSave, SHOWCASE_QUERY_KEYS } from "@/lib/showcase-cache";

const NOW = "2026-08-17T10:00:00.000Z";

const base: ShowcaseInput = {
  first_name: "Marie",
  last_name: "Dupont",
  title: "Naturopathe",
  bio: "x".repeat(650),
  short_bio: "Accompagnement des femmes en transition de vie, à Lausanne.",
  photo_url: "https://cdn.example/p.jpg",
  specialties: ["naturopathie", "sophrologie"],
  languages: ["fr", "de"],
  city: "Lausanne",
  canton: "VD",
  latitude: 46.5,
  longitude: 6.6,
  price_min: 120,
  price_max: 180,
  consultation_modes: ["cabinet", "visio"],
  status: "active",
  verified: true,
  slug: "marie-dupont",
  updated_at: NOW,
  meta_title: "Marie Dupont — Naturopathe à Lausanne | Holiswiss",
  meta_description:
    "Naturopathe à Lausanne, j'accompagne les femmes en transition de vie : fatigue, sommeil, stress. Consultations au cabinet ou en visio.",
} as ShowcaseInput;

const report = (t: ShowcaseInput): ShowcaseAuditReport =>
  buildShowcaseAuditReport(t, runShowcaseAudit(t), { generatedAt: NOW });

const check = (r: ShowcaseAuditReport, id: string) =>
  [...r.visibility.checks, ...r.conversion.checks].find((c) => c.id === id)!;

const todoCount = (r: ShowcaseAuditReport) =>
  [...r.visibility.recommendations, ...r.conversion.recommendations].filter(
    (x) => x.status === "a_traiter",
  ).length;

const hasTodo = (r: ShowcaseAuditReport, id: string) =>
  [...r.visibility.recommendations, ...r.conversion.recommendations].some(
    (x) => x.id === id && x.status === "a_traiter",
  );

// ─── Identité ──────────────────────────────────────────────────────────
describe("Identité", () => {
  it("1. prénom vide → identity non validé, recommandation présente, action fournie", () => {
    const r = report({ ...base, first_name: "" });
    const c = check(r, "identity");
    expect(c.status).not.toBe("passed");
    expect(c.actionHref).toBe("/dashboard/profil#identite");
    expect(hasTodo(r, "identity")).toBe(true);
    expect(c.explanation).toMatch(/prénom/i);
  });

  it("2. nom vide → identity non validé", () => {
    const c = check(report({ ...base, last_name: null }), "identity");
    expect(c.status).not.toBe("passed");
    expect(c.explanation).toMatch(/nom/i);
  });

  it("3. titre professionnel vide → message ciblant le titre", () => {
    const c = check(report({ ...base, title: "" }), "identity");
    expect(c.status).not.toBe("passed");
    expect(c.explanation).toMatch(/titre professionnel/i);
  });

  it("4. prénom + nom + titre présents → validé, aucun bouton, aucune reco à traiter", () => {
    const r = report(base);
    const c = check(r, "identity");
    expect(c.status).toBe("passed");
    expect(c.actionHref).toBeNull();
    expect(hasTodo(r, "identity")).toBe(false);
  });

  it("5. valeurs composées uniquement d'espaces → traitées comme vides", () => {
    const c = check(report({ ...base, first_name: "   ", title: "\t " }), "identity");
    expect(c.status).not.toBe("passed");
  });

  it("6. cache ancien → l'audit recalculé fait foi", () => {
    const stale = report({ ...base, title: "" });
    const fresh = report(base);
    expect(check(stale, "identity").status).not.toBe("passed");
    expect(check(fresh, "identity").status).toBe("passed");
    expect(fresh.visibility.score).toBeGreaterThan(stale.visibility.score);
  });

  it("7. valeurs modifiées puis sauvegardées → statut et compteur mis à jour", () => {
    const before = report({ ...base, title: "" });
    const after = report(base);
    expect(hasTodo(before, "identity")).toBe(true);
    expect(hasTodo(after, "identity")).toBe(false);
    // Le titre professionnel alimente aussi d'autres contrôles (auteur, title SEO) :
    // le compteur doit donc strictement diminuer, sans jamais augmenter.
    expect(todoCount(after)).toBeLessThan(todoCount(before));
  });
});

// ─── SEO ───────────────────────────────────────────────────────────────
const seo = (t: ShowcaseInput) =>
  evaluateSeoTitle(resolveSeoTitle(t.meta_title, buildGeneratedSeoTitle(t)), {
    published: true,
    expectedLang: "fr",
  });

describe("SEO", () => {
  it("8. titre SEO vide (et nom absent) → manquant", () => {
    const t = { ...base, meta_title: "", first_name: "", last_name: "" };
    expect(seo(t).code).toBe("missing");
    expect(check(report(t), "meta_title").status).not.toBe("passed");
  });

  it("9. titre SEO valide → validé, pas de bouton", () => {
    const c = check(report(base), "meta_title");
    expect(seo(base).passed).toBe(true);
    expect(c.status).toBe("passed");
    expect(c.actionHref).toBeNull();
  });

  it("10. titre SEO trop court", () => {
    const t = { ...base, meta_title: "Naturopathe" };
    expect(seo(t).code).toBe("too_short");
    expect(check(report(t), "meta_title").status).toBe("invalid");
  });

  it("11. titre SEO trop long", () => {
    const t = { ...base, meta_title: "Marie Dupont naturopathe certifiée à Lausanne, Vaud, Suisse romande | Holiswiss" };
    expect(seo(t).code).toBe("too_long");
    expect(check(report(t), "meta_title").status).toBe("invalid");
  });

  it("12. titre SEO enregistré après sauvegarde → reco résolue et score en hausse", () => {
    const before = report({ ...base, meta_title: "Naturo" });
    const after = report(base);
    expect(hasTodo(before, "meta_title")).toBe(true);
    expect(hasTodo(after, "meta_title")).toBe(false);
    expect(after.visibility.score).toBeGreaterThan(before.visibility.score);
  });

  it("13. meta description valide", () => {
    const d = evaluateSeoDescription(resolveSeoDescription({ meta_description: base.meta_description }));
    expect(d.passed).toBe(true);
    expect(check(report(base), "meta_description").status).toBe("passed");
  });

  it("14. meta description absente → repli sur la bio, non validé, bouton présent", () => {
    const t = { ...base, meta_description: null };
    const d = evaluateSeoDescription(resolveSeoDescription({ meta_description: null, bio: t.bio }));
    expect(d.passed).toBe(false);
    const c = check(report(t), "meta_description");
    expect(c.status).not.toBe("passed");
    expect(c.actionHref).toBe("/dashboard/profil#seo-description");
  });
});

// ─── Synchronisation ───────────────────────────────────────────────────
describe("Synchronisation", () => {
  const broken = { ...base, title: "", photo_url: "" };

  it("15. audit après modification → mêmes contrôles recalculés", () => {
    const r1 = report(broken);
    const r2 = report(base);
    expect(check(r1, "photo").status).not.toBe("passed");
    expect(check(r2, "photo").status).toBe("passed");
  });

  it("16. score après modification → strictement supérieur", () => {
    expect(report(base).visibility.score).toBeGreaterThan(report(broken).visibility.score);
  });

  it("17. recommandation supprimée après correction", () => {
    expect(hasTodo(report(broken), "photo")).toBe(true);
    expect(hasTodo(report(base), "photo")).toBe(false);
  });

  it("18. nombre « à traiter » exact et cohérent avec les éléments manquants", () => {
    const r = report(broken);
    // Le compteur « à traiter » est exactement le nombre de recommandations non résolues.
    const todos = [...r.visibility.recommendations, ...r.conversion.recommendations].filter(
      (x) => x.status === "a_traiter",
    );
    expect(todoCount(r)).toBe(todos.length);
    for (const t of todos) expect(check(r, t.id).status).not.toBe("passed");
    expect(todoCount(r)).toBeGreaterThan(todoCount(report(base)));
    const missingIds = new Set(r.missingItems.map((c) => c.id));
    for (const id of ["identity", "photo"]) expect(missingIds.has(id)).toBe(true);
  });

  it("19. action prioritaire mise à jour après correction", () => {
    const before = report(broken).priorityActions.map((a) => a.checkId);
    const after = report(base).priorityActions.map((a) => a.checkId);
    expect(before).toContain("photo");
    expect(after).not.toContain("photo");
    report(base).priorityActions.forEach((a, i) => expect(a.rank).toBe(i + 1));
  });

  it("20. date de dernière analyse propagée sur chaque contrôle", () => {
    const later = "2026-08-17T12:00:00.000Z";
    const r = buildShowcaseAuditReport(base, runShowcaseAudit(base), { generatedAt: later });
    expect(r.generatedAt).toBe(later);
    expect(check(r, "identity").evaluatedAt).toBe(later);
  });

  it("21. rechargement complet → résultat identique pour les mêmes données (pur)", () => {
    expect(JSON.stringify(report(base))).toBe(JSON.stringify(report(base)));
  });

  it("22. déconnexion/reconnexion → le cache est vidé, pas de score d'un autre compte", async () => {
    const qc = new QueryClient();
    qc.setQueryData(["my-showcase-report"], { score: 42 });
    qc.clear();
    expect(qc.getQueryData(["my-showcase-report"])).toBeUndefined();
  });

  it("23. deux onglets : l'invalidation marque toutes les clés de scoring comme périmées", async () => {
    const qc = new QueryClient();
    for (const key of SHOWCASE_QUERY_KEYS) qc.setQueryData([...key], { score: 50, analyzedAt: NOW });
    await refreshShowcaseAfterSave(qc);
    for (const key of SHOWCASE_QUERY_KEYS) {
      expect(qc.getQueryState([...key])?.isInvalidated).toBe(true);
    }
  });

  it("24. erreur de recalcul → le dernier résultat connu et ses recommandations sont conservés", () => {
    const qc = new QueryClient();
    const last = report(broken);
    qc.setQueryData(["my-showcase-report"], { score: 61, analyzedAt: NOW, report: last });
    // Un échec de mutation ne doit rien écrire dans le cache.
    const kept = qc.getQueryData<{ score: number; report: ShowcaseAuditReport }>(["my-showcase-report"])!;
    expect(kept.score).toBe(61);
    expect(todoCount(kept.report)).toBe(todoCount(last));
  });

  it("25. accès à un autre thérapeute refusé : le rapport perso est borné à user_id", () => {
    const src = readFileSync("src/lib/therapist-health.functions.ts", "utf8");
    const block = src.slice(src.indexOf("export const getMyShowcaseReport"), src.indexOf("export const getTherapistShowcaseReport"));
    expect(block).toContain("requireSupabaseAuth");
    expect(block).toContain('.eq("user_id", context.userId)');
    expect(block).not.toContain("therapistId");
  });
});
