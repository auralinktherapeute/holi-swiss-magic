/**
 * Agent Automation — constantes et calculs purs, sans accès réseau ni base.
 * Partagé entre le serveur (policy, fonctions) et l'interface admin.
 */

export const AUTOMATION_LEVELS = [
  "observe",
  "recommend",
  "prepare",
  "execute_validated",
  "automate",
] as const;
export type AutomationLevel = (typeof AUTOMATION_LEVELS)[number];

export const LEVEL_LABELS: Record<AutomationLevel, string> = {
  observe: "Observer",
  recommend: "Recommander",
  prepare: "Préparer",
  execute_validated: "Exécuter après validation",
  automate: "Automatiser",
};

export const DECISIONS = ["ignore", "snooze", "reanalyze", "modify", "accept"] as const;
export type AutomationDecision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<AutomationDecision, string> = {
  ignore: "Ignorer",
  snooze: "Reporter",
  reanalyze: "Demander une nouvelle analyse",
  modify: "Modifier",
  accept: "Accepter",
};

/** Statut de proposition résultant de chaque décision (aucune action externe). */
export const DECISION_TO_STATUS: Record<AutomationDecision, string> = {
  ignore: "ignored",
  snooze: "snoozed",
  reanalyze: "reanalysis_requested",
  modify: "modified",
  accept: "accepted",
};

export function levelIndex(level: AutomationLevel): number {
  return AUTOMATION_LEVELS.indexOf(level);
}

export function isAutomationLevel(v: unknown): v is AutomationLevel {
  return typeof v === "string" && (AUTOMATION_LEVELS as readonly string[]).includes(v);
}

/* ── Apprentissage v1 : indicateurs uniquement ─────────────────────────── */

export type DecisionRow = { proposal_id: string; decision: string; action_key: string };
export type OutcomeRow = { action_key: string; polarity: string };

export type LearningStat = {
  action_key: string;
  decisions: number;
  accepted: number;
  ignored: number;
  modified: number;
  acceptance_rate: number | null;
  positive: number;
  negative: number;
  neutral: number;
  /** Suggestion seulement : n'est JAMAIS appliquée automatiquement. */
  suggested_level: AutomationLevel | null;
};

/** Seuils minimaux avant toute suggestion d'évolution de niveau. */
export const LEARNING_MIN_DECISIONS = 10;
export const LEARNING_MIN_ACCEPTANCE = 0.8;

export function computeLearning(
  decisions: DecisionRow[],
  outcomes: OutcomeRow[],
  current: Record<string, AutomationLevel>,
  ceilings: Record<string, AutomationLevel>,
): LearningStat[] {
  const keys = new Set<string>([
    ...decisions.map((d) => d.action_key),
    ...outcomes.map((o) => o.action_key),
  ]);
  const stats: LearningStat[] = [];
  for (const key of keys) {
    const ds = decisions.filter((d) => d.action_key === key);
    const os = outcomes.filter((o) => o.action_key === key);
    const accepted = ds.filter((d) => d.decision === "accept").length;
    const ignored = ds.filter((d) => d.decision === "ignore").length;
    const modified = ds.filter((d) => d.decision === "modify").length;
    const positive = os.filter((o) => o.polarity === "positive").length;
    const negative = os.filter((o) => o.polarity === "negative").length;
    const neutral = os.filter((o) => o.polarity === "neutral").length;
    const rate = ds.length ? accepted / ds.length : null;

    let suggested: AutomationLevel | null = null;
    const cur = current[key] ?? "observe";
    const ceiling = ceilings[key] ?? "observe";
    if (
      ds.length >= LEARNING_MIN_DECISIONS &&
      rate !== null &&
      rate >= LEARNING_MIN_ACCEPTANCE &&
      negative === 0
    ) {
      const next = AUTOMATION_LEVELS[levelIndex(cur) + 1];
      if (next && levelIndex(next) <= levelIndex(ceiling)) suggested = next;
    }
    stats.push({
      action_key: key,
      decisions: ds.length,
      accepted,
      ignored,
      modified,
      acceptance_rate: rate,
      positive,
      negative,
      neutral,
      suggested_level: suggested,
    });
  }
  return stats.sort((a, b) => a.action_key.localeCompare(b.action_key));
}

/* ── Textes des états vides (testés) ──────────────────────────────────── */

export const EMPTY_STATES = {
  recommendations:
    "Aucune recommandation pour l'instant. L'agent n'en produit que lorsque le réglage global est activé et qu'une règle est au niveau « Recommander » ou plus. Activez-les dans l'onglet Règles.",
  pending:
    "Rien à valider. Les propositions apparaissent ici lorsqu'une règle est au niveau « Préparer » et qu'un aperçu prêt à exécuter a été préparé.",
  journal:
    "Le journal est vide : aucune action n'a encore été exécutée. Chaque exécution future y sera enregistrée avec son état avant/après et ses données d'annulation.",
  learning:
    "Pas encore d'indicateurs : ils seront calculés à partir de vos décisions explicites et des résultats mesurés.",
} as const;
