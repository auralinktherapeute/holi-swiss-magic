import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import {
  AUTOMATION_LEVELS,
  DECISIONS,
  DECISION_TO_STATUS,
  computeLearning,
  isAutomationLevel,
  type AutomationLevel,
} from "@/lib/automation-shared";

const SETTING_KEY = "automation_enabled";

/** Vue d'ensemble : uniquement des données réelles lues en base. */
export const getAutomationOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const policy = await import("@/lib/automation-policy.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = context.supabase;

    const [setting, rules, proposals, decisions, runs, outcomes] = await Promise.all([
      supabaseAdmin.from("app_settings").select("value").eq("key", SETTING_KEY).maybeSingle(),
      sb.from("automation_rules").select("action_key, level, enabled, updated_at").order("action_key"),
      sb
        .from("automation_proposals")
        .select("id, action_key, title, rationale, level, status, prepared_preview, snoozed_until, created_at")
        .in("status", ["open", "snoozed", "reanalysis_requested", "modified"])
        .order("created_at", { ascending: false })
        .limit(200),
      sb.from("automation_decisions").select("proposal_id, decision, automation_proposals(action_key)").limit(5000),
      sb
        .from("automation_runs")
        .select("id, action_key, level, status, error, created_at, rolled_back_at")
        .order("created_at", { ascending: false })
        .limit(100),
      sb.from("automation_outcomes").select("polarity, automation_runs(action_key)").limit(5000),
    ]);
    for (const r of [rules, proposals, decisions, runs, outcomes]) {
      if (r.error) {
        console.error("[automation] overview read failed", r.error.code);
        throw new Error("Lecture impossible pour le moment. Réessayez.");
      }
    }
    if (setting.error) throw new Error("Lecture du réglage global impossible.");

    const ruleRows = rules.data ?? [];
    const current: Record<string, AutomationLevel> = {};
    for (const r of ruleRows) if (isAutomationLevel(r.level)) current[r.action_key] = r.level;
    const ceilings: Record<string, AutomationLevel> = {};
    for (const a of policy.ACTION_CATALOG) ceilings[a.key] = policy.getActionCeiling(a.key);

    const learning = computeLearning(
      (decisions.data ?? []).map((d: any) => ({
        proposal_id: d.proposal_id,
        decision: d.decision,
        action_key: d.automation_proposals?.action_key ?? "inconnu",
      })),
      (outcomes.data ?? []).map((o: any) => ({
        polarity: o.polarity,
        action_key: o.automation_runs?.action_key ?? "inconnu",
      })),
      current,
      ceilings,
    );

    const catalog = policy.ACTION_CATALOG.map((a) => {
      const rule = ruleRows.find((r) => r.action_key === a.key);
      return {
        key: a.key,
        label: a.label,
        description: a.description,
        ceiling: ceilings[a.key],
        level: (rule && isAutomationLevel(rule.level) ? rule.level : "observe") as AutomationLevel,
        enabled: rule?.enabled ?? false,
        configured: !!rule,
        updated_at: rule?.updated_at ?? null,
      };
    });

    const open = proposals.data ?? [];
    return {
      enabled: setting.data?.value === true,
      phaseMaxLevel: policy.PHASE_MAX_LEVEL,
      catalog,
      recommendations: open.filter((p) => !p.prepared_preview),
      pending: open.filter((p) => !!p.prepared_preview),
      runs: runs.data ?? [],
      learning,
    };
  });

/** Interrupteur global (désactivé par défaut : clé absente = false). */
export const setAutomationEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({ key: SETTING_KEY, value: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error("Impossible d'enregistrer le réglage.");
    return { enabled: data.enabled };
  });

/** Modification d'une règle : session de l'admin humain (jamais le service role). */
export const updateAutomationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        action_key: z.string().min(1).max(80),
        level: z.enum(AUTOMATION_LEVELS),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const policy = await import("@/lib/automation-policy.server");
    const check = policy.checkRuleChange(data.action_key, data.level);
    if (!check.ok) throw new Error(check.reason);
    const { error } = await context.supabase.from("automation_rules").upsert(
      {
        action_key: data.action_key,
        level: data.level,
        enabled: data.enabled,
        updated_by: context.userId,
      },
      { onConflict: "action_key" },
    );
    if (error) {
      console.error("[automation] rule write failed", error.code);
      throw new Error("Impossible d'enregistrer la règle.");
    }
    return { ok: true };
  });

/** Décision explicite sur une proposition. Aucune action externe en phase 1. */
export const decideAutomationProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        proposal_id: z.string().uuid(),
        decision: z.enum(DECISIONS),
        reason: z.string().max(2000).optional().nullable(),
        snooze_until: z.string().datetime().optional().nullable(),
        modified_payload: z.record(z.string(), z.unknown()).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.decision === "snooze" && !data.snooze_until) {
      throw new Error("Indiquez une date de report.");
    }
    const sb = context.supabase;
    const { error: dErr } = await sb.from("automation_decisions").insert({
      proposal_id: data.proposal_id,
      decision: data.decision,
      reason: data.reason ?? null,
      snooze_until: data.snooze_until ?? null,
      modified_payload: (data.modified_payload ?? null) as never,
      decided_by: context.userId,
    });
    if (dErr) throw new Error("Impossible d'enregistrer la décision.");
    const { error: pErr } = await sb
      .from("automation_proposals")
      .update({
        status: DECISION_TO_STATUS[data.decision],
        snoozed_until: data.decision === "snooze" ? data.snooze_until : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.proposal_id);
    if (pErr) throw new Error("Décision enregistrée, mais statut non mis à jour.");
    return { ok: true };
  });
