/**
 * Pré-vérification automatique d'un diplôme / d'une certification.
 *
 * Fonction pure, sans accès réseau ni base : elle rapproche l'organisme saisi
 * des registres suisses reconnus et signale ce qui manque avant de soumettre
 * le dossier à la validation de l'administrateur. Elle ne décide jamais seule
 * qu'un diplôme est vérifié — seul un administrateur peut le faire.
 */

export type AutoCheckVerdict = "recognized" | "plausible" | "incomplete";

export interface AutoCheckInput {
  name: string;
  issuer?: string | null;
  year?: number | null;
  hasFile: boolean;
}

export interface AutoCheckResult {
  verdict: AutoCheckVerdict;
  /** Organisme reconnu identifié, si trouvé. */
  registry: string | null;
  /** Points de contrôle satisfaits. */
  passed: string[];
  /** Points de contrôle manquants (à corriger par le thérapeute). */
  missing: string[];
  /** Résumé court, lisible par l'administrateur. */
  summary: string;
}

/** Registres et associations faîtières suisses reconnus. */
const REGISTRIES: Array<{ key: string; label: string; patterns: RegExp }> = [
  { key: "asca", label: "ASCA", patterns: /\basca\b|fondation suisse pour les m[ée]decines compl[ée]mentaires/i },
  { key: "rme", label: "RME / EMR", patterns: /\brme\b|\bemr\b|registre de m[ée]decine empirique|erfahrungsmedizinisches register/i },
  { key: "eduqua", label: "eduQua", patterns: /eduqua/i },
  { key: "oda-kt", label: "OdA KT / OrTra MC", patterns: /\boda\s*kt\b|\bortra\b|organisation du monde du travail/i },
  { key: "asdc", label: "ASD / APTN", patterns: /\basdc?\b|\baptn\b/i },
  { key: "sgs", label: "SGS / Visana / Swica (assureurs)", patterns: /\bsgs\b|visana|swica|groupe mutuel/i },
  { key: "fsp", label: "FSP (psychologues)", patterns: /\bfsp\b|f[ée]d[ée]ration suisse des psychologues/i },
  { key: "asne", label: "Diplôme fédéral", patterns: /dipl[ôo]me f[ée]d[ée]ral|brevet f[ée]d[ée]ral|sefri|sbfi/i },
];

export function autoCheckCertification(input: AutoCheckInput): AutoCheckResult {
  const haystack = `${input.name ?? ""} ${input.issuer ?? ""}`.trim();
  const registry = REGISTRIES.find((r) => r.patterns.test(haystack)) ?? null;

  const passed: string[] = [];
  const missing: string[] = [];

  if ((input.name ?? "").trim().length >= 3) passed.push("Intitulé du diplôme renseigné");
  else missing.push("Intitulé du diplôme trop court");

  if ((input.issuer ?? "").trim().length >= 2) passed.push("Organisme délivrant renseigné");
  else missing.push("Organisme délivrant manquant");

  const currentYear = new Date().getFullYear();
  if (input.year != null && input.year >= 1950 && input.year <= currentYear) passed.push(`Année plausible (${input.year})`);
  else missing.push("Année d'obtention manquante ou improbable");

  if (input.hasFile) passed.push("Justificatif joint");
  else missing.push("Aucun justificatif joint");

  if (registry) passed.push(`Organisme reconnu : ${registry.label}`);

  const verdict: AutoCheckVerdict =
    missing.length === 0 && registry ? "recognized" : missing.length === 0 ? "plausible" : "incomplete";

  const summary =
    verdict === "recognized"
      ? `Pré-vérification OK — organisme reconnu (${registry?.label}), justificatif joint.`
      : verdict === "plausible"
        ? "Pré-vérification OK — dossier complet, organisme non répertorié."
        : `Dossier incomplet — ${missing.join(", ").toLowerCase()}.`;

  return { verdict, registry: registry?.label ?? null, passed, missing, summary };
}
