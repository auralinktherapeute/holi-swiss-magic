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
// dans la fenêtre même s'il ne porte pas du tout sur « guérit » (N4), et le
// scan réintroduisait le bug 1 dans un nouvel endroit via un `\b` ASCII sur
// « ne » isolé, qui matchait à tort la fin de « hygiène » (N5). Remplacé par
// une vérification de CONTENANCE DE SPAN : chaque motif sûr est matché comme
// phrase complète, et un terme interdit n'est blanchi que s'il tombe
// ENTIÈREMENT dans un span déjà matché — jamais par proximité approximative.
//
// Audit 2026-10-02d, sur cette version span-containment, a trouvé :
//   - N7 : les motifs sûrs eux-mêmes utilisaient encore `\b` ASCII → « Hélène
//     soigne pas à pas » et « la méthode d'Irène guérit pas à pas » étaient
//     blanchis à tort (le même bug de frontière que le bug 1, pour la 3e
//     fois, maintenant dans les motifs sûrs). Corrigé en appliquant les MÊMES
//     frontières Unicode (helper `phrase()`) à chaque motif sûr, pas
//     seulement à `LPMED_FORBIDDEN`.
//   - N8 : `cura di s[ée]` n'avait pas de frontière de fin → « una cura di
//     sei sedute » / « di sette giorni » étaient blanchis à tort. Corrigé par
//     le même helper (toute frontière de fin est désormais systématique).
//   - N6 (non corrigé ici — limite structurelle, pas un oversight) : les
//     motifs « négation collée au verbe » ne regardent que ce qui suit
//     immédiatement, pas la portée de la négation au-delà. Des tournures
//     comme « ne soigne pas QUE X, mais aussi Y », « pas de guérison durable
//     SANS Y », « n'est pas un traitement COMME LES AUTRES », ou un
//     comparatif (« aucun traitement n'agit plus vite que... ») continuent de
//     passer alors qu'elles allèguent bien un effet thérapeutique. Chaque
//     nouvelle tournure corrigée en ajoutant un motif ouvre statistiquement
//     la porte à la suivante (negation scope est un problème de
//     compréhension du langage, pas un problème de regex) : voir la synthèse
//     envoyée à l'utilisateur pour la décision produit (accepter ce risque
//     résiduel documenté, ou ajouter un second palier de jugement LLM — le
//     B5 de `marketing-qa` — sur le chemin web qui n'en a aujourd'hui aucun).

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

/**
 * Enveloppe une phrase-source avec les MÊMES frontières Unicode que
 * `LPMED_FORBIDDEN` (lettre accentuée incluse) — un `\b` ASCII ici a déjà
 * causé le même bug de frontière deux fois de suite (N5, N7). Un seul
 * endroit qui sait faire une frontière correcte, jamais un `\b` ad hoc.
 */
function phrase(source: string): RegExp {
  return new RegExp(`(?<![\\p{L}])(?:${source})(?![\\p{L}])`, "iu");
}

// Phrases qui emploient ce vocabulaire SANS allégation — au contraire, ce
// sont souvent les disclaimers légaux requis, ou des idiomes génériques qui
// n'allèguent rien. Chaque motif est EXACT et SERRÉ : la négation doit être
// directement collée au terme. Vérifiés par CONTENANCE DE SPAN (voir
// `computeSafeSpans` / `isWithinSafeSpan` plus bas), jamais par proximité
// approximative — et N6 (non résolu) reste une limite structurelle : voir la
// note d'audit 2026-10-02d en tête de fichier.
const SAFE_IDIOMS: RegExp[] = [
  // Disclaimers réels (marketing-carousels.ts:277 et ses traductions)
  phrase("aucune?\\s+promesse\\s+de\\s+gu[ée]rison"),
  phrase("sans\\s+promesse\\s+de\\s+gu[ée]rison"),
  phrase("keine\\s+heilversprechen"),
  phrase("nessun[ae]?\\s+promessa\\s+di\\s+guarigione"),
  phrase("no\\s+healing\\s+claims?"),
  // Négation directement sur le verbe — FR
  phrase("ne\\s+soigne[nz]?\\s+pas"),
  phrase("ne\\s+soignons\\s+pas"),
  phrase("ne\\s+gu[ée]ri[st]?\\s+pas"),
  phrase("ne\\s+gu[ée]rissent\\s+pas"),
  phrase("ne\\s+traite[nz]?\\s+pas"),
  phrase("ne\\s+traitons\\s+pas"),
  phrase("n['’]est\\s+pas\\s+(?:un|une)\\s+(?:traitement|diagnostic|prescription)"),
  phrase("pas\\s+de\\s+(?:promesse\\s+de\\s+)?(?:gu[ée]rison|traitement|diagnostic|prescription)"),
  // Négation directement sur le verbe — DE/IT/EN
  phrase("keine?\\s+heilung"),
  phrase("nicht\\s+(?:behandelt|geheilt)"),
  phrase("nessun[ao]?\\s+(?:cura|trattamento|diagnosi)"),
  phrase("non\\s+(?:cura|tratta|guarisce)"),
  phrase("no\\s+(?:cure|treatment|diagnosis)"),
  phrase("(?:does\\s+not|doesn['’]t|is\\s+not\\s+a)\\s+(?:cure|treat|heal)"),
  // Idiomes génériques de bien-être (pas une allégation thérapeutique)
  phrase("prendre\\s+soin\\s+de\\s+(?:soi|vous|vos|eux|elle|lui)"),
  phrase("soins?\\s+de\\s+soi"),
  phrase("cura\\s+di\\s+s[ée]"),
  phrase("self[\\s-]?care"),
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
