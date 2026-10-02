import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ACTION_CATALOG,
  FORBIDDEN_ACTIONS,
  PHASE_MAX_LEVEL,
  canActorWriteRules,
  checkRuleChange,
  getActionCeiling,
} from "./automation-policy.server";
import { EMPTY_STATES, computeLearning } from "./automation-shared";
import { AutomationEmptyState } from "@/components/admin/AutomationEmptyState";

describe("automation policy", () => {
  it("bloque les actions interdites et inconnues", () => {
    expect(checkRuleChange("send_email", "observe").ok).toBe(false);
    expect(checkRuleChange("automation_rules_write", "observe").ok).toBe(false);
    expect(checkRuleChange("inconnue", "observe").ok).toBe(false);
    expect(getActionCeiling("payment_change")).toBe("observe");
  });
  it("respecte le plafond de phase", () => {
    for (const a of ACTION_CATALOG) {
      expect(checkRuleChange(a.key, "execute_validated").ok).toBe(false);
      expect(checkRuleChange(a.key, "automate").ok).toBe(false);
      expect(checkRuleChange(a.key, "observe").ok).toBe(true);
    }
    expect(PHASE_MAX_LEVEL).toBe("prepare");
  });
  it("aucun acteur non humain ne peut écrire les règles", () => {
    expect(canActorWriteRules({ kind: "agent" })).toBe(false);
    expect(canActorWriteRules({ kind: "system" })).toBe(false);
    expect(canActorWriteRules({ kind: "human_admin" })).toBe(true);
    expect(FORBIDDEN_ACTIONS.has("automation_policy_change")).toBe(true);
  });
});

describe("apprentissage v1", () => {
  const ceilings = { a: "prepare" as const };
  it("ne suggère rien sans assez de décisions", () => {
    const d = Array.from({ length: 5 }, (_, i) => ({ proposal_id: `${i}`, decision: "accept", action_key: "a" }));
    expect(computeLearning(d, [], { a: "observe" }, ceilings)[0].suggested_level).toBeNull();
  });
  it("suggère le niveau suivant, borné au plafond, jamais avec résultat négatif", () => {
    const d = Array.from({ length: 10 }, (_, i) => ({ proposal_id: `${i}`, decision: "accept", action_key: "a" }));
    expect(computeLearning(d, [], { a: "observe" }, ceilings)[0].suggested_level).toBe("recommend");
    expect(computeLearning(d, [], { a: "prepare" }, ceilings)[0].suggested_level).toBeNull();
    expect(computeLearning(d, [{ action_key: "a", polarity: "negative" }], { a: "observe" }, ceilings)[0].suggested_level).toBeNull();
  });
  it("aucune donnée = aucun indicateur", () => {
    expect(computeLearning([], [], {}, {})).toEqual([]);
  });
});

describe("états vides", () => {
  it("rend un message explicatif", () => {
    const html = renderToStaticMarkup(createElement(AutomationEmptyState, { text: EMPTY_STATES.journal }));
    expect(html).toContain("Le journal est vide");
    expect(html).toContain('role="status"');
  });
});

describe("contraintes de la migration", () => {
  const sql = readFileSync("drizzle/migrations/0007_agent_automation_foundation.sql", "utf8");
  it("journal append-only et règles réservées à un humain", () => {
    expect(sql).toMatch(/grant select on public\.automation_runs to authenticated;/);
    expect(sql).toMatch(/automation_runs_append_only/);
    expect(sql).toMatch(/auth\.uid\(\) is null or not public\.is_admin/);
    expect(sql).not.toMatch(/insert into public\.automation_/i);
    expect(sql).not.toMatch(/to anon/);
  });
});
