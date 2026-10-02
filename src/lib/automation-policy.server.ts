/**
 * Agent Automation — garde-fou de sécurité. CODÉ EN DUR, volontairement.
 *
 * - Aucun chemin d'exécution (agent, tâche planifiée, IA) ne peut modifier ce
 *   fichier, ni écrire dans `automation_rules` : la table refuse toute écriture
 *   sans administrateur humain authentifié (trigger en base), et les fonctions
 *   serveur passent par la session de l'admin, jamais par le service role.
 * - Seul un changement de code relu par un humain peut relever un plafond.
 */
import {
  AUTOMATION_LEVELS,
  levelIndex,
  type AutomationLevel,
} from "./automation-shared";

/** Plafond global de la phase en cours : aucune exécution n'est branchée. */
export const PHASE_MAX_LEVEL: AutomationLevel = "prepare";

/** Catalogue fermé des actions connues, avec plafond propre à chacune. */
export const ACTION_CATALOG: ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  max_level: AutomationLevel;
}> = Object.freeze([
  {
    key: "profile_health_followup",
    label: "Suivi santé des profils",
    description: "Repère les fiches thérapeutes incomplètes à partir des recommandations santé existantes.",
    max_level: "prepare",
  },
  {
    key: "seo_finding_triage",
    label: "Tri des constats SEO/GEO",
    description: "Classe les constats SEO ouverts par impact, à partir des audits existants.",
    max_level: "prepare",
  },
  {
    key: "crm_followup_task",
    label: "Tâches de relance CRM",
    description: "Propose des tâches de relance dans le CRM. Aucune tâche n'est créée en phase 1.",
    max_level: "prepare",
  },
]);

/** Actions qui ne pourront JAMAIS dépasser « Observer » ni être exécutées. */
export const FORBIDDEN_ACTIONS: ReadonlySet<string> = Object.freeze(
  new Set([
    "automation_rules_write",
    "automation_policy_change",
    "send_email",
    "send_whatsapp",
    "payment_change",
    "subscription_change",
    "role_change",
    "certification_change",
    "publish_site",
    "delete_data",
    "gpld_write",
  ]),
) as ReadonlySet<string>;

export function getActionCeiling(actionKey: string): AutomationLevel {
  if (FORBIDDEN_ACTIONS.has(actionKey)) return "observe";
  const entry = ACTION_CATALOG.find((a) => a.key === actionKey);
  if (!entry) return "observe";
  return levelIndex(entry.max_level) <= levelIndex(PHASE_MAX_LEVEL)
    ? entry.max_level
    : PHASE_MAX_LEVEL;
}

export type PolicyCheck = { ok: true } | { ok: false; reason: string };

/** Vérifie qu'un niveau demandé par un admin respecte le plafond. */
export function checkRuleChange(actionKey: string, level: AutomationLevel): PolicyCheck {
  if (!AUTOMATION_LEVELS.includes(level)) return { ok: false, reason: "Niveau inconnu." };
  if (FORBIDDEN_ACTIONS.has(actionKey)) {
    return { ok: false, reason: "Action interdite par la politique de sécurité." };
  }
  if (!ACTION_CATALOG.some((a) => a.key === actionKey)) {
    return { ok: false, reason: "Action absente du catalogue autorisé." };
  }
  const ceiling = getActionCeiling(actionKey);
  if (levelIndex(level) > levelIndex(ceiling)) {
    return { ok: false, reason: `Niveau au-delà du plafond autorisé pour cette action.` };
  }
  return { ok: true };
}

/** L'agent (sans humain) ne peut jamais modifier ses règles. */
export function canActorWriteRules(actor: { kind: "human_admin" | "agent" | "system" }): boolean {
  return actor.kind === "human_admin";
}
