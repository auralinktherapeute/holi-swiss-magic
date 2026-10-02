// Vocabulaire interdit par la LPMéd (Suisse) : un thérapeute non médecin ne
// « soigne » ni ne « guérit », ne pose pas de « diagnostic », ne « prescrit »
// pas. Liste multilingue (FR/DE/IT/EN) — reprend le motif FR déjà utilisé par
// `article-clean.functions.ts` et le motif multilingue déjà testé par
// `local-faq.test.ts` / `therapist-auto-faq.test.ts`, en un seul point source
// pour que les deux ne divergent plus silencieusement.
//
// Audit 2026-10-02b a trouvé 3 bugs dans la v1 de ce fichier, corrigés ici :
//   1. `\b` ne pose pas de frontière après une lettre accentuée (« é » n'est
//      pas \w en JS) → « soigné », « traité » ne matchaient jamais. Remplacé
//      par des frontières Unicode (`(?<!\p{L})…(?!\p{L})`, flag `u`).
//   2. Faux positifs sur les phrases qui citent ce vocabulaire pour le NIER —
//      exactement les disclaimers légaux déjà en prod : « Aucune promesse de
//      guérison » (marketing-carousels.ts:277), « Keine Heilversprechen »,
//      « Nessuna promessa di guarigione », « No healing claims » — et sur les
//      idiomes de bien-être génériques (« prendre soin de soi », « cura di
//      sé ») qui n'allèguent rien. Ajout d'une fenêtre de négation
//      multilingue + une liste d'idiomes explicitement sûrs.
//   3. `countForbidden` (article-clean) comparait des comptes AVANT/APRÈS
//      dédupliqués — un mot déjà présent qui se répète n'était plus détecté.
//      `countForbiddenOccurrences` (non dédupliqué) répare ça ;
//      `findForbiddenTerms` reste dédupliqué pour les messages d'erreur.

const TERMS = [
  // FR — soigner
  "soin", "soins", "soigner", "soignant", "soigné", "soignée", "soignés", "soignées",
  "soigne", "soignes", "soignons", "soignez", "soignent",
  // FR — guérir
  "guérison", "guérisons", "guérir", "guérissant", "guéri", "guérie", "guéris", "guéries",
  "guérit", "guérissons", "guérissez", "guérissent",
  // FR — traiter
  "traitement", "traitements", "traiter", "traitant", "traité", "traitée", "traités", "traitées",
  "traite", "traites", "traitons", "traitez", "traitent",
  // FR — diagnostiquer / prescrire
  "diagnostic", "diagnostiquer", "diagnostique", "prescription", "prescrire", "prescrit",
  // DE
  "heilt", "heilen", "heilung", "heilende", "heilender", "heilendes",
  "behandelt", "behandlung", "behandeln",
  // IT
  "cura", "curano", "curare", "curato", "guarisce", "guarigione", "guarire",
  // EN
  "cure", "cures", "cured", "curing",
  "heal", "heals", "healing", "healed",
  "treat", "treats", "treated", "treating", "treatment",
];

const TERMS_PATTERN = TERMS.join("|");

/** Frontières Unicode (lettre accentuée incluse) au lieu de `\b` — voir note ci-dessus. */
export const LPMED_FORBIDDEN = new RegExp(
  `(?<![\\p{L}])(?:${TERMS_PATTERN})(?![\\p{L}])`,
  "giu",
);

// Phrases qui emploient ce vocabulaire SANS allégation — au contraire, ce
// sont souvent les disclaimers légaux requis. Vérifiées sur une fenêtre
// autour de chaque match avant de conclure à une violation.
const SAFE_IDIOMS: RegExp[] = [
  /aucune?\s+promesse\s+de\s+gu[ée]rison/i,
  /sans\s+promesse\s+de\s+gu[ée]rison/i,
  /keine\s+heilversprechen/i,
  /nessun[ae]?\s+promessa\s+di\s+guarigione/i,
  /no\s+healing\s+claims?/i,
  /prendre\s+soin\s+de\s+(soi|vous|vos|eux|elle|lui)/i,
  /\bsoins?\s+de\s+soi\b/i,
  /cura\s+di\s+s[ée]/i,
  /self[\s-]?care/i,
];

// Négation immédiatement avant le terme (fenêtre courte, multilingue) :
// « ne soigne pas », « n'est pas un traitement », « keine Heilung »,
// « nessuna cura », « no cure », « not a treatment ».
const NEGATION_BEFORE =
  /\b(ne|n['’]|aucun[e]?|sans|jamais|non|keine[nrs]?|nessun[ao]?|no|not|never)\b[^.!?\n]{0,30}$/i;

function isSafeContext(text: string, matchIndex: number, matchLength: number): boolean {
  const windowStart = Math.max(0, matchIndex - 40);
  const windowEnd = Math.min(text.length, matchIndex + matchLength + 40);
  const window = text.slice(windowStart, windowEnd);
  if (SAFE_IDIOMS.some((re) => re.test(window))) return true;

  const before = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  return NEGATION_BEFORE.test(before);
}

interface ForbiddenHit {
  term: string;
  index: number;
}

function rawHits(text: string | null | undefined): ForbiddenHit[] {
  if (!text) return [];
  const hits: ForbiddenHit[] = [];
  const re = new RegExp(LPMED_FORBIDDEN.source, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!isSafeContext(text, m.index, m[0].length)) {
      hits.push({ term: m[0], index: m.index });
    }
    if (m[0].length === 0) re.lastIndex += 1; // garde-fou anti-boucle infinie
  }
  return hits;
}

/**
 * Compte total (non dédupliqué) des violations réelles — un mot interdit
 * répété deux fois compte deux fois. Utilisé par `article-clean.functions.ts`
 * pour comparer un texte avant/après réécriture : la répétition d'un terme
 * déjà présent doit rester détectable.
 */
export function countForbiddenOccurrences(text: string | null | undefined): number {
  return rawHits(text).length;
}

/** Liste dédupliquée des termes interdits trouvés — pour un message d'erreur lisible. */
export function findForbiddenTerms(text: string | null | undefined): string[] {
  return [...new Set(rawHits(text).map((h) => h.term.toLowerCase()))];
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
