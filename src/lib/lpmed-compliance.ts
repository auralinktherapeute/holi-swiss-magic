// Vocabulaire interdit par la LPMéd (Suisse) : un thérapeute non médecin ne
// « soigne » ni ne « guérit », ne pose pas de « diagnostic », ne « prescrit »
// pas. Liste multilingue (FR/DE/IT/EN) — reprend le motif FR déjà utilisé par
// `article-clean.functions.ts` et le motif multilingue déjà testé par
// `local-faq.test.ts` / `therapist-auto-faq.test.ts`, en un seul point source
// pour que les deux ne divergent plus silencieusement.
export const LPMED_FORBIDDEN =
  /\b(soin|soins|soigner|soignant|soigné|soignée|soignés|soignées|soigne|soignes|soignons|soignez|soignent|guérison|guérisons|guérir|guérissant|guéri|guérie|guéris|guéries|guéris|guérit|guérissons|guérissez|guérissent|traitement|traitements|traiter|traitant|traité|traitée|traités|traitées|traite|traites|traitons|traitez|traitent|diagnostic|diagnostiquer|diagnostique|prescription|prescrire|prescrit|heilt|heilen|heilung|heilende?s?|behandelt|behandlung|behandeln|cura|curano|curare|curato|guarisce|guarigione|guarire|cures?|cured?|curing|heals?|healing|healed|treats?|treated|treating|treatment)\b/gi;

export function findForbiddenTerms(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(LPMED_FORBIDDEN) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

/**
 * Lève une erreur si l'un des champs fournis contient une allégation
 * thérapeutique interdite par la LPMéd. Ne corrige jamais le texte : refuse,
 * comme `/marketing-publish` refuse une proposition non `valide` — à l'humain
 * de reformuler.
 */
export function assertNoHealthClaims(
  fields: Record<string, string | null | undefined>,
): void {
  const violations: string[] = [];
  for (const [field, value] of Object.entries(fields)) {
    const terms = findForbiddenTerms(value);
    if (terms.length) violations.push(`${field} : "${terms.join('", "')}"`);
  }
  if (violations.length) {
    throw new Error(
      `Allégation de santé interdite (LPMéd) détectée — ${violations.join(" · ")}. Reformulez sans promesse thérapeutique avant d'enregistrer.`,
    );
  }
}
