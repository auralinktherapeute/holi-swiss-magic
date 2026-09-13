/**
 * Pré-vérification automatique d'un diplôme / d'une certification.
 *
 * Fonction pure, sans accès réseau ni base : elle rapproche l'organisme saisi
 * des registres suisses reconnus et signale ce qui manque avant de soumettre
 * le dossier à la validation de l'administrateur. Elle ne décide jamais seule
 * qu'un diplôme est vérifié — seul un administrateur peut le faire.
 */

export type AutoCheckVerdict = "recognized" | "plausible" | "incomplete";

/** Type/organisme déclaré par le thérapeute (purement déclaratif). */
export type CredentialType = "asca" | "rme" | "federal" | "other";

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  asca: "ASCA",
  rme: "RME / EMR",
  federal: "Diplôme fédéral",
  other: "Autre organisme",
};

/** Libellés du résultat automatique — jamais le mot « Vérifié ». */
export const AUTOCHECK_LABELS: Record<AutoCheckVerdict, string> = {
  recognized: "Dossier prêt à être soumis",
  plausible: "Dossier plausible",
  incomplete: "Informations manquantes",
};

/** Mention affichée en permanence à côté du résultat automatique. */
export const AUTOCHECK_DISCLAIMER = "Pré-vérification uniquement — validation finale par Holiswiss";

export interface AutoCheckInput {
  name: string;
  issuer?: string | null;
  year?: number | null;
  hasFile: boolean;
  /** Nouveaux champs structurés (optionnels : compatibilité avec l'existant). */
  credentialType?: CredentialType | string | null;
  registrationNumber?: string | null;
  holderName?: string | null;
  /** Date d'expiration au format ISO (AAAA-MM-JJ), optionnelle. */
  expiresAt?: string | null;
}

export interface AutoCheckResult {
  verdict: AutoCheckVerdict;
  /** Libellé lisible du verdict (jamais « Vérifié »). */
  label: string;
  /** Organisme reconnu identifié, si trouvé. */
  registry: string | null;
  /** Points de contrôle satisfaits. */
  passed: string[];
  /** Points de contrôle manquants (à corriger par le thérapeute). */
  missing: string[];
  /** Remarques non bloquantes (champs optionnels vides, expiration passée…). */
  notes: string[];
  /** Résumé court, lisible par l'administrateur. */
  summary: string;
  /** Rappel constant : la validation finale reste manuelle. */
  disclaimer: string;
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

/** Correspondance directe entre le type déclaré et un registre reconnu. */
const TYPE_TO_REGISTRY: Record<string, string> = {
  asca: "ASCA",
  rme: "RME / EMR",
  federal: "Diplôme fédéral",
};

export function autoCheckCertification(input: AutoCheckInput): AutoCheckResult {
  const haystack = `${input.name ?? ""} ${input.issuer ?? ""}`.trim();
  const typeKey = typeof input.credentialType === "string" ? input.credentialType.toLowerCase() : null;
  const registryLabel =
    (typeKey && TYPE_TO_REGISTRY[typeKey]) ?? REGISTRIES.find((r) => r.patterns.test(haystack))?.label ?? null;

  const passed: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [];

  if ((input.name ?? "").trim().length >= 3) passed.push("Intitulé du diplôme renseigné");
  else missing.push("Intitulé du diplôme trop court");

  if ((input.issuer ?? "").trim().length >= 2) passed.push("Organisme délivrant renseigné");
  else missing.push("Organisme délivrant manquant");

  const currentYear = new Date().getFullYear();
  if (input.year != null && input.year >= 1950 && input.year <= currentYear) passed.push(`Année plausible (${input.year})`);
  else missing.push("Année d'obtention manquante ou improbable");

  if (input.hasFile) passed.push("Justificatif joint");
  else missing.push("Aucun justificatif joint");

  // Champs structurés : le type et le nom exact sont attendus pour une
  // soumission fiable ; le numéro et l'expiration restent optionnels afin de
  // ne pas bloquer les diplômes qui n'en comportent pas.
  if (typeKey) {
    passed.push(`Type déclaré : ${CREDENTIAL_TYPE_LABELS[(typeKey as CredentialType)] ?? typeKey}`);
  } else {
    missing.push("Type d'organisme non sélectionné");
  }

  if ((input.holderName ?? "").trim().length >= 3) passed.push("Nom exact figurant sur le document renseigné");
  else missing.push("Nom exact figurant sur le document manquant");

  if ((input.registrationNumber ?? "").trim().length >= 3) passed.push("Numéro d'enregistrement renseigné");
  else notes.push("Numéro d'enregistrement absent (optionnel, mais il accélère la vérification)");

  const exp = (input.expiresAt ?? "").trim();
  if (exp) {
    const d = new Date(exp);
    if (Number.isNaN(d.getTime())) notes.push("Date d'expiration illisible");
    else if (d.getTime() < Date.now()) notes.push("Date d'expiration déjà dépassée");
    else passed.push(`Valable jusqu'au ${exp}`);
  }

  if (registryLabel) passed.push(`Organisme reconnu : ${registryLabel}`);

  const verdict: AutoCheckVerdict =
    missing.length === 0 && registryLabel ? "recognized" : missing.length === 0 ? "plausible" : "incomplete";

  const summary =
    verdict === "recognized"
      ? `Pré-vérification OK — organisme reconnu (${registryLabel}), justificatif joint.`
      : verdict === "plausible"
        ? "Pré-vérification OK — dossier complet, organisme non répertorié."
        : `Dossier incomplet — ${missing.join(", ").toLowerCase()}.`;

  return {
    verdict,
    label: AUTOCHECK_LABELS[verdict],
    registry: registryLabel,
    passed,
    missing,
    notes,
    summary,
    disclaimer: AUTOCHECK_DISCLAIMER,
  };
}
