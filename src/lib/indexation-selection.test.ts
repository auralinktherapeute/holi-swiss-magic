import { describe, expect, it } from "vitest";
import {
  buildStateSection,
  countStale,
  orderInspectionCandidates,
  type InspectionCandidate,
} from "../../supabase/functions/run-indexation/selection";

const row = (o: Partial<InspectionCandidate> & { id: string }): InspectionCandidate => ({
  url: `https://holiswiss.ch/${o.id}`,
  status: "discovered",
  priority: 4,
  last_checked_at: null,
  ...o,
});

describe("orderInspectionCandidates", () => {
  it("un article jamais inspecté passe devant un listing fraîchement contrôlé", () => {
    const rows = [
      row({ id: "listing", priority: 2, last_checked_at: "2026-09-20T02:00:00Z" }),
      row({ id: "fiche", priority: 1, last_checked_at: "2026-09-20T02:00:00Z" }),
      row({ id: "article", priority: 4, last_checked_at: null }),
    ];
    expect(orderInspectionCandidates(rows, 3).map((r) => r.id)).toEqual([
      "article",
      "fiche",
      "listing",
    ]);
  });

  it("un article contrôlé en juillet passe devant un listing contrôlé hier", () => {
    const rows = [
      row({ id: "listing", priority: 2, last_checked_at: "2026-09-20T02:00:00Z" }),
      row({ id: "article", priority: 4, last_checked_at: "2026-07-14T02:00:00Z" }),
    ];
    expect(orderInspectionCandidates(rows, 1).map((r) => r.id)).toEqual(["article"]);
  });

  it("la priorité ne sert qu'à départager entre jamais-inspectées", () => {
    const rows = [
      row({ id: "b-article", priority: 4 }),
      row({ id: "a-fiche", priority: 1 }),
    ];
    expect(orderInspectionCandidates(rows, 2).map((r) => r.id)).toEqual(["a-fiche", "b-article"]);
  });

  it("l'ordre est stable à égalité parfaite (id en dernier recours)", () => {
    const same = "2026-09-01T00:00:00Z";
    const rows = [
      row({ id: "zz", last_checked_at: same }),
      row({ id: "aa", last_checked_at: same }),
    ];
    expect(orderInspectionCandidates(rows, 2).map((r) => r.id)).toEqual(["aa", "zz"]);
    expect(orderInspectionCandidates([...rows].reverse(), 2).map((r) => r.id)).toEqual([
      "aa",
      "zz",
    ]);
  });

  it("respecte la limite et ne plante pas sur une limite nulle", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    expect(orderInspectionCandidates(rows, 2)).toHaveLength(2);
    expect(orderInspectionCandidates(rows, 0)).toHaveLength(0);
  });
});

describe("countStale", () => {
  it("compte les jamais inspectées et les contrôles trop vieux", () => {
    const now = Date.parse("2026-09-21T00:00:00Z");
    const rows = [
      row({ id: "jamais", last_checked_at: null }),
      row({ id: "vieux", last_checked_at: "2026-07-01T00:00:00Z" }),
      row({ id: "frais", last_checked_at: "2026-09-20T00:00:00Z" }),
    ];
    expect(countStale(rows, 30, now)).toBe(2);
  });
});

describe("buildStateSection", () => {
  const section = buildStateSection({
    active: 432,
    notIndexed: 397,
    neverInspected: 223,
    staleChecks: 260,
    staleDays: 30,
    total: 448,
    inspected: 85,
    inspectFailures: 3,
    indexNowSubmitted: 40,
    indexNowStatus: 200,
  });

  it("distingue le périmètre suivi du constat de non-indexation", () => {
    expect(section).toMatch(/432 URLs actives suivies/);
    expect(section).toMatch(/ce n'est PAS un nombre de pages non indexées/);
    expect(section).toMatch(/non indexées au dernier contrôle : 397/);
  });

  it("annonce un compte indisponible plutôt qu'un faux zéro", () => {
    const degraded = buildStateSection({
      active: null,
      notIndexed: null,
      neverInspected: 223,
      staleChecks: null,
      staleDays: 30,
      total: null,
      inspected: 0,
      inspectFailures: 0,
      indexNowSubmitted: 0,
      indexNowStatus: 0,
    });
    expect(degraded).toMatch(/indisponible \(lecture en échec\)/);
    expect(degraded).not.toMatch(/ : 0\./);
    // `status === 0` = aucun appel : « HTTP 0 » n'existe pas.
    expect(degraded).not.toMatch(/HTTP 0/);
    expect(degraded).toMatch(/aucune soumission ce run/);
  });

  it("annonce les jamais inspectées et la fraîcheur du suivi", () => {
    expect(section).toMatch(/Jamais inspectées par Search Console : 223/);
    expect(section).toMatch(/plus ancien que 30 j.*: 260/);
  });

  it("rend visibles les échecs d'inspection", () => {
    expect(section).toMatch(/3 appel\(s\) Search Console en échec/);
    expect(section).toMatch(/aucun état n'a été dégradé/);
  });

  it("refuse de présenter une soumission IndexNow comme une indexation", () => {
    expect(section).toMatch(/Une soumission acceptée n'est pas une indexation/);
  });

  it("n'affiche pas de mention d'échec quand il n'y en a aucun", () => {
    const clean = buildStateSection({
      active: 1,
      notIndexed: 0,
      neverInspected: 0,
      staleChecks: 0,
      staleDays: 30,
      total: 1,
      inspected: 1,
      inspectFailures: 0,
      indexNowSubmitted: 0,
      indexNowStatus: 0,
    });
    expect(clean).not.toMatch(/échec/);
  });
});
