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
//      sé ») qui n'allèguent rien.
//   3. `countForbidden` (article-clean) comparait des comptes AVANT/APRÈS
//      dédupliqués — un mot déjà présent qui se répète n'était plus détecté.
//      `countForbiddenOccurrences` (non dédupliqué) répare ça ;
//      `findForbiddenTerms` reste dédupliqué pour les messages d'erreur.
//
// Audit 2026-10-02c a trouvé que la CORRECTION du bug 2 (une fenêtre
// générique « un mot de négation dans les ~30-40 caractères qui précèdent »)
// ouvrait un trou pire que le bug d'origine : « Sans médicaments, notre
// méthode guérit l'anxiété » n'était plus détecté, parce que « sans » est
// dans la fenêtre même s'il ne porte pas du tout sur « guérit ». La fenêtre
// générique est donc supprimée. Les 4 disclaimers réels restent couverts,
// mais par des motifs EXACTS et serrés (négation directement collée au
// verbe : « ne soigne pas », « n'est pas un traitement »...), jamais par une
// proximité approximative qui ne comprend pas la portée grammaticale.

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
// sont souvent les disclaimers légaux requis, ou des idiomes génériques qui
// n'allèguent rien. Chaque motif est EXACT et SERRÉ : la négation doit être
// directement collée au terme (pas de fenêtre de proximité approximative —
// voir la note d'audit 2026-10-02c en tête de fichier). Vérifiés sur une
// petite fenêtre autour de chaque match, mais c'est le motif complet qui
// doit matcher dans cette fenêtre, jamais un mot de négation isolé.
const SAFE_IDIOMS: RegExp[] = [
  // Disclaimers réels (marketing-carousels.ts:277 et ses traductions)
  /aucune?\s+promesse\s+de\s+gu[ée]rison/i,
  /sans\s+promesse\s+de\s+gu[ée]rison/i,
  /keine\s+heilversprechen/i,
  /nessun[ae]?\s+promessa\s+di\s+guarigione/i,
  /no\s+healing\s+claims?/i,
  // Négation directement sur le verbe — FR
  /\bne\s+soigne[nz]?\s+pas\b/i,
  /\bne\s+soignons\s+pas\b/i,
  /\bne\s+gu[ée]ri[st]?\s+pas\b/i,
  /\bne\s+gu[ée]rissent\s+pas\b/i,
  /\bne\s+traite[nz]?\s+pas\b/i,
  /\bne\s+traitons\s+pas\b/i,
  /\bn['’]est\s+pas\s+(?:un|une)\s+(?:traitement|diagnostic|prescription)\b/i,
  /\bpas\s+de\s+(?:promesse\s+de\s+)?(?:gu[ée]rison|traitement|diagnostic|prescription)\b/i,
  // Négation directement sur le verbe — DE/IT/EN
  /\bkeine?\s+heilung\b/i,
  /\bnicht\s+(?:behandelt|geheilt)\b/i,
  /\bnessun[ao]?\s+(?:cura|trattamento|diagnosi)\b/i,
  /\bnon\s+(?:cura|tratta|guarisce)\b/i,
  /\bno\s+(?:cure|treatment|diagnosis)\b/i,
  /\b(?:does\s+not|doesn['’]t|is\s+not\s+a)\s+(?:cure|treat|heal)\b/i,
  // Idiomes génériques de bien-être (pas une allégation thérapeutique)
  /prendre\s+soin\s+de\s+(soi|vous|vos|eux|elle|lui)/i,
  /\bsoins?\s+de\s+soi\b/i,
  /cura\s+di\s+s[ée]/i,
  /self[\s-]?care/i,
];

/**
 * Spans (début, fin) de chaque occurrence de chaque idiome sûr dans le
 * texte. Un hit n'est sûr QUE si sa position tombe ENTIÈREMENT à
 * l'intérieur d'un de ces spans — pas « quelque part dans une fenêtre
 * autour » (c'est précisément ce qui causait le faux-négatif N4 de l'audit
 * 2026-10-02c : un idiome sûr présent ailleurs dans la phrase ne doit
 * jamais blanchir une allégation réelle qui le suit).
 */
function computeSafeSpans(text: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  for (const re of SAFE_IDIOMS) {
    const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
    const r = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    while ((m = r.exec(text))) {
      spans.push([m.index, m.index + m[0].length]);
      if (m[0].length === 0) r.lastIndex += 1;
    }
  }
  return spans;
}

function isWithinSafeSpan(
  spans: Array<[number, number]>,
  matchIndex: number,
  matchLength: number,
): boolean {
  const hitEnd = matchIndex + matchLength;
  return spans.some(([start, end]) => matchIndex >= start && hitEnd <= end);
}

interface ForbiddenHit {
  term: string;
  index: number;
}

function rawHits(text: string | null | undefined): ForbiddenHit[] {
  if (!text) return [];
  const safeSpans = computeSafeSpans(text);
  const hits: ForbiddenHit[] = [];
  const re = new RegExp(LPMED_FORBIDDEN.source, "giu");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!isWithinSafeSpan(safeSpans, m.index, m[0].length)) {
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
