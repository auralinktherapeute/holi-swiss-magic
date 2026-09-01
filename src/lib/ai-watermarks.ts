// Détection et suppression des traces d'IA dans les articles.
//
// Portage TypeScript de la couche déterministe de guillaumemeyer/watermarks-remover
// (skill `clean-user-facing-text`, module `text_unicode.py`), plus une couche
// stylométrique propre au français.
//
// Deux couches, volontairement séparées :
//
//   A — INVISIBLE (déterministe, gratuit, réversible en pratique)
//       Caractères de format Unicode, sélecteurs de variation, plages à usage
//       privé, marques bidi, homoglyphes d'espace. Ce sont les porteurs
//       « edit-based » : ils survivent au copier-coller et identifient un texte
//       machine sans qu'on les voie. On les retire sans jamais toucher au sens.
//
//   B — STYLOMÉTRIQUE (détection seulement ici, réécriture côté serveur)
//       Les tics d'écriture LLM en français. On ne peut pas les corriger par
//       regex sans abîmer la prose : ce module les COMPTE et les localise, la
//       réécriture est faite par le modèle avec garde-fou de score.
//
// Une réserve honnête, reprise du dépôt d'origine : les filigranes
// STATISTIQUES (échantillonnage de tokens, type SynthID-Text) ne sont pas
// détectables ici, et aucun nettoyage ne « prouve » une écriture humaine.

// ─────────────────────────────────────────────────────────────────────────────
// Couche A — Unicode invisible
// ─────────────────────────────────────────────────────────────────────────────

/** Contrôles de format servant de porteurs stéganographiques ou de résidus de collage. */
const STRIP_CODEPOINTS = new Set<number>([
  0x00ad, // soft hyphen
  0x034f, // combining grapheme joiner
  0x061c, // Arabic letter mark
  0x115f,
  0x1160, // Hangul fillers
  0x17b4,
  0x17b5, // Khmer inherent vowels
  0x180b,
  0x180c,
  0x180d,
  0x180e, // Mongolian FVS + vowel separator
  0x200b,
  0x200c,
  0x200d, // ZWSP, ZWNJ, ZWJ
  0x200e,
  0x200f, // LRM, RLM
  0x202a,
  0x202b,
  0x202c,
  0x202d,
  0x202e, // embedding / override
  0x2060,
  0x2061,
  0x2062,
  0x2063,
  0x2064, // word joiner, invisible operators
  0x2066,
  0x2067,
  0x2068,
  0x2069, // isolates
  0x206a,
  0x206b,
  0x206c,
  0x206d,
  0x206e,
  0x206f,
  0xfeff, // BOM / ZWNBSP
  0xfe00,
  0xfe01,
  0xfe02,
  0xfe03,
  0xfe04,
  0xfe05,
  0xfe06,
  0xfe07,
  0xfe08,
  0xfe09,
  0xfe0a,
  0xfe0b,
  0xfe0c,
  0xfe0d,
  0xfe0e,
  0xfe0f,
  0xfff9,
  0xfffa,
  0xfffb, // interlinear annotation
]);

/** Espaces qui ressemblent à U+0020 (ou s'y substituent). */
const SPACE_HOMOGLYPHS = new Map<number, string>([
  [0x00a0, " "], // insécable
  [0x1680, " "],
  [0x2000, " "],
  [0x2001, " "],
  [0x2002, " "],
  [0x2003, " "],
  [0x2004, " "],
  [0x2005, " "],
  [0x2006, " "],
  [0x2007, " "],
  [0x2008, " "],
  [0x2009, " "],
  [0x200a, " "],
  [0x202f, " "], // insécable étroite
  [0x205f, " "],
  [0x3000, " "],
]);

/** Sosies latins (mode agressif uniquement : un texte suisse multilingue peut
 *  légitimement contenir du cyrillique dans une citation). */
const LATIN_CONFUSABLES = new Map<number, string>([
  [0x0410, "A"],
  [0x0412, "B"],
  [0x0415, "E"],
  [0x041a, "K"],
  [0x041c, "M"],
  [0x041d, "H"],
  [0x041e, "O"],
  [0x0420, "P"],
  [0x0421, "C"],
  [0x0422, "T"],
  [0x0425, "X"],
  [0x0430, "a"],
  [0x0435, "e"],
  [0x043e, "o"],
  [0x0440, "p"],
  [0x0441, "c"],
  [0x0443, "y"],
  [0x0445, "x"],
  [0x0456, "i"],
]);

const EMOJI_GLUE = new Set<number>([0x200d, 0xfe0e, 0xfe0f]);
const SCRIPT_JOINERS = new Set<number>([0x200c, 0x200d]);

const isPrivateUse = (cp: number) =>
  (cp >= 0xe000 && cp <= 0xf8ff) ||
  (cp >= 0xf0000 && cp <= 0xffffd) ||
  (cp >= 0x100000 && cp <= 0x10fffd);

const isTagChar = (cp: number) => cp >= 0xe0001 && cp <= 0xe007f;
const isVsSupplement = (cp: number) => cp >= 0xe0100 && cp < 0xe01f0;

const isStripCp = (cp: number) =>
  STRIP_CODEPOINTS.has(cp) || isVsSupplement(cp) || isTagChar(cp) || isPrivateUse(cp);

/** Base pouvant démarrer ou prolonger une séquence emoji. */
function isEmojiBase(cp: number): boolean {
  if (cp >= 0x1f000 && cp <= 0x1faff) return true;
  if (cp >= 0x2600 && cp <= 0x27bf) return true;
  if (cp >= 0x2b00 && cp <= 0x2bff) return true;
  if ([0x00a9, 0x00ae, 0x2122, 0x3030, 0x303d, 0x3297, 0x3299].includes(cp)) return true;
  if (cp === 0x0023 || cp === 0x002a || (cp >= 0x0030 && cp <= 0x0039)) return true;
  return false;
}

/** Lettre non-ASCII : le voisin qui rend un liant orthographique (persan, devanagari…). */
const isJoiningLetter = (cp: number) => cp > 0x7f && /\p{L}|\p{M}/u.test(String.fromCodePoint(cp));

/** Invisible porteur de sens : glu emoji, liant de script, tag de drapeau. */
const isGlue = (cp: number) =>
  EMOJI_GLUE.has(cp) || SCRIPT_JOINERS.has(cp) || (cp >= 0xe0020 && cp < 0xe0080);

/**
 * En typographie française, U+00A0 (insécable) et U+202F (insécable étroite)
 * sont CORRECTS avant `: ; ! ? » %` et après `«` — ce ne sont pas des traces
 * d'IA à cet endroit, c'est la règle. Ailleurs (au milieu d'un mot, en fin de
 * ligne, entre deux lettres) ce sont des porteurs, et on les normalise.
 *
 * C'est un écart assumé par rapport au dépôt d'origine, qui normalise tous les
 * homoglyphes d'espace sans distinction : il ne cible pas une prose française.
 */
const FRENCH_NBSP = new Set<number>([0x00a0, 0x202f]);
const NBSP_FOLLOWERS = new Set([":", ";", "!", "?", "»", "%", "€", "‰"]);
const NBSP_LEADERS = new Set(["«"]);

export type MarkKind =
  | "zwj_family"
  | "bidi"
  | "variation_selector"
  | "tag_chars"
  | "private_use"
  | "other_cf"
  | "space"
  | "confusable";

export interface InvisibleHit {
  codepoint: number;
  label: string;
  count: number;
  kind: MarkKind;
  /** Décalages en unités de code UTF-16, dix premiers. */
  samples: number[];
}

function strippedKind(cp: number): MarkKind {
  if (isTagChar(cp)) return "tag_chars";
  if (isVsSupplement(cp) || (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0x180b && cp <= 0x180d))
    return "variation_selector";
  if (
    [
      0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068,
      0x2069,
    ].includes(cp)
  )
    return "bidi";
  if ([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x180e].includes(cp)) return "zwj_family";
  if (isPrivateUse(cp)) return "private_use";
  return "other_cf";
}

const CP_NAMES: Record<number, string> = {
  0x00ad: "SOFT HYPHEN",
  0x200b: "ZERO WIDTH SPACE",
  0x200c: "ZERO WIDTH NON-JOINER",
  0x200d: "ZERO WIDTH JOINER",
  0x200e: "LEFT-TO-RIGHT MARK",
  0x200f: "RIGHT-TO-LEFT MARK",
  0x2060: "WORD JOINER",
  0xfeff: "ZERO WIDTH NO-BREAK SPACE (BOM)",
  0x00a0: "NO-BREAK SPACE",
  0x202f: "NARROW NO-BREAK SPACE",
  0x2009: "THIN SPACE",
  0x2002: "EN SPACE",
  0x2003: "EM SPACE",
  0x205f: "MEDIUM MATHEMATICAL SPACE",
  0xfe0f: "VARIATION SELECTOR-16",
  0xfe0e: "VARIATION SELECTOR-15",
  0x034f: "COMBINING GRAPHEME JOINER",
};

const label = (cp: number) =>
  `U+${cp.toString(16).toUpperCase().padStart(4, "0")} ${CP_NAMES[cp] ?? "CARACTÈRE INVISIBLE"}`;

export interface CleanOptions {
  /** Normaliser les homoglyphes d'espace (défaut : oui, hors positions FR légitimes). */
  normalizeSpaces?: boolean;
  /** Remplacer les sosies latins cyrilliques/pleine-chasse (défaut : non). */
  aggressiveHomoglyphs?: boolean;
  /** Retirer aussi la glu emoji et les liants de script (défaut : non — casse ❤️‍🔥). */
  stripEmojiGlue?: boolean;
}

export interface CleanResult {
  text: string;
  removed: number;
  replaced: number;
  hits: InvisibleHit[];
}

/**
 * Retire les porteurs invisibles d'un texte et rend un rapport.
 * L'itération se fait par point de code (`for…of`), donc les paires de
 * substitution (emoji) sont traitées comme un seul caractère.
 */
export function cleanInvisible(text: string, opts: CleanOptions = {}): CleanResult {
  const { normalizeSpaces = true, aggressiveHomoglyphs = false, stripEmojiGlue = false } = opts;

  const out: string[] = [];
  const buckets = new Map<string, InvisibleHit>();
  let removed = 0;
  let replaced = 0;
  let prevKept: number | null = null;
  let offset = 0;

  // Nécessaire pour la règle française : on doit regarder le caractère SUIVANT.
  const chars = Array.from(text);

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cp = ch.codePointAt(0)!;
    const width = ch.length;

    const record = (kind: MarkKind) => {
      const key = `${cp}:${kind}`;
      const hit = buckets.get(key) ?? {
        codepoint: cp,
        label: label(cp),
        count: 0,
        kind,
        samples: [],
      };
      hit.count++;
      if (hit.samples.length < 10) hit.samples.push(offset);
      buckets.set(key, hit);
    };

    // Invisibles porteurs de sens : conservés s'ils suivent la bonne base.
    if (!stripEmojiGlue) {
      if (EMOJI_GLUE.has(cp) && prevKept !== null && isEmojiBase(prevKept)) {
        out.push(ch);
        offset += width;
        continue;
      }
      if (SCRIPT_JOINERS.has(cp) && prevKept !== null && isJoiningLetter(prevKept)) {
        out.push(ch);
        offset += width;
        continue;
      }
      if (isTagChar(cp) && prevKept !== null && isEmojiBase(prevKept)) {
        out.push(ch);
        offset += width;
        continue;
      }
    }

    // Insécables françaises à leur place légitime : on ne touche pas.
    if (FRENCH_NBSP.has(cp)) {
      const next = chars[i + 1];
      const prevCh = prevKept !== null ? String.fromCodePoint(prevKept) : "";
      if ((next && NBSP_FOLLOWERS.has(next)) || NBSP_LEADERS.has(prevCh)) {
        out.push(ch);
        prevKept = cp;
        offset += width;
        continue;
      }
    }

    if (isStripCp(cp)) {
      record(strippedKind(cp));
      removed++;
      offset += width;
      continue; // prevKept inchangé : une strip ne casse pas une chaîne ZWJ
    }

    if (normalizeSpaces && SPACE_HOMOGLYPHS.has(cp)) {
      const rep = SPACE_HOMOGLYPHS.get(cp)!;
      record("space");
      replaced++;
      out.push(rep);
      prevKept = rep.codePointAt(0)!;
      offset += width;
      continue;
    }

    if (aggressiveHomoglyphs && LATIN_CONFUSABLES.has(cp)) {
      const rep = LATIN_CONFUSABLES.get(cp)!;
      record("confusable");
      replaced++;
      out.push(rep);
      prevKept = rep.codePointAt(0)!;
      offset += width;
      continue;
    }

    // Reste des Cf non listés (nouvelles versions d'Unicode) : on retire.
    if (/\p{Cf}/u.test(ch)) {
      record("other_cf");
      removed++;
      offset += width;
      continue;
    }

    out.push(ch);
    if (!isGlue(cp)) prevKept = cp;
    offset += width;
  }

  const hits = [...buckets.values()].sort((a, b) => b.count - a.count || a.codepoint - b.codepoint);
  return { text: out.join(""), removed, replaced, hits };
}

// ─────────────────────────────────────────────────────────────────────────────
// Couche B — tics d'écriture LLM en français (détection)
// ─────────────────────────────────────────────────────────────────────────────

export interface StyleTell {
  key: string;
  label: string;
  count: number;
  /** Ce que la réécriture doit faire. Sert de consigne au modèle. */
  instruction: string;
  /** Premiers extraits trouvés, pour l'affichage. */
  samples: string[];
}

interface TellSpec {
  key: string;
  label: string;
  pattern: RegExp;
  /** Nombre d'occurrences à partir duquel c'est un tic et non un usage normal. */
  threshold: number;
  instruction: string;
}

/** Ces motifs sont calibrés pour du français de blog bien-être, pas de l'anglais.
 *  Chaque seuil est là parce qu'une occurrence isolée est du français normal :
 *  c'est la répétition qui signe la machine. */
const TELL_SPECS: TellSpec[] = [
  {
    key: "not_only_but",
    label: "Antithèse « il ne s'agit pas de… mais de… »",
    pattern:
      /\b(?:il ne s(?:'|’)agit pas (?:seulement |simplement |uniquement )?d[eu']|ce n(?:'|’)est pas (?:seulement |simplement )?(?:un|une|le|la)\b[^.!?]{0,60},\s*c(?:'|’)est|non pas\b[^.!?]{0,50}\bmais bien)/gi,
    threshold: 1,
    instruction:
      "Supprimer les tournures d'antithèse « il ne s'agit pas de X, mais de Y » : affirmer directement ce qui est.",
  },
  {
    key: "dive_in",
    label: "Invitation « plongeons / explorons ensemble »",
    pattern:
      /\b(?:plongeons?|plongée au c(?:œ|oe)ur|explorons ensemble|partons (?:à la découverte|ensemble)|embarquez pour|découvrons ensemble)\b/gi,
    threshold: 1,
    instruction:
      "Supprimer les invitations rhétoriques (« plongeons dans », « explorons ensemble ») : entrer dans le sujet directement.",
  },
  {
    key: "in_a_world",
    label: "Ouverture « dans un monde où / à l'heure où »",
    pattern:
      /\b(?:dans un monde où|à l(?:'|’)heure où|à une époque où|dans notre société (?:moderne|actuelle)|de nos jours,)/gi,
    threshold: 1,
    instruction:
      "Remplacer les ouvertures panoramiques (« dans un monde où… ») par une entrée en matière concrète et située en Suisse.",
  },
  {
    key: "important_to_note",
    label: "Méta-commentaire « il est important de noter »",
    pattern:
      /\b(?:il est (?:important|essentiel|crucial|primordial) de (?:noter|souligner|rappeler|comprendre|savoir)|il convient de (?:noter|souligner|préciser)|notons que|à noter que|il faut savoir que)\b/gi,
    threshold: 1,
    instruction:
      "Supprimer les méta-commentaires (« il est important de noter que ») et énoncer le fait directement.",
  },
  {
    key: "conclusion_marker",
    label: "Balise de conclusion explicite",
    pattern:
      /^[ \t]*#{0,4}[ \t]*(?:\*\*)?[ \t]*(?:en conclusion|pour conclure|en résumé|en somme|pour résumer|en définitive)\b/gim,
    threshold: 1,
    instruction:
      "Retirer les balises « En conclusion / Pour résumer » : la dernière section doit conclure sans s'annoncer.",
  },
  {
    key: "whether_you",
    label: "Adresse « que vous soyez… ou… »",
    pattern: /\bque vous soyez\b/gi,
    threshold: 1,
    instruction:
      "Supprimer les segmentations « que vous soyez X ou Y » : s'adresser à un lecteur, pas à une matrice de personas.",
  },
  {
    key: "dont_hesitate",
    label: "Formule « n'hésitez pas à »",
    pattern: /\bn(?:'|’)hésitez pas à\b/gi,
    threshold: 1,
    instruction:
      "Remplacer « n'hésitez pas à » par une invitation directe (« prenez rendez-vous », « écrivez-nous »).",
  },
  {
    key: "journey",
    label: "Métaphore du voyage / du chemin",
    pattern:
      /\b(?:votre (?:voyage|cheminement|parcours) vers|ce voyage (?:intérieur|vers)|un (?:voyage|chemin) vers (?:le|la|l(?:'|’))|au fil de ce (?:parcours|voyage))\b/gi,
    threshold: 1,
    instruction:
      "Supprimer les métaphores de voyage intérieur, sauf si la source du texte les emploie réellement.",
  },
  {
    key: "unlock_potential",
    label: "Promesse « libérez votre potentiel »",
    pattern:
      /\b(?:libérez?(?: tout)? (?:votre|le|son) potentiel|débloquez|révéler tout (?:son|votre) potentiel|transformez votre (?:vie|quotidien))\b/gi,
    threshold: 1,
    instruction:
      "Supprimer les promesses de transformation (« libérez votre potentiel ») : incompatibles avec la LPMéd et typiques d'un texte machine.",
  },
  {
    key: "hollow_intensifier",
    label: "Intensificateurs creux (véritable, incontournable…)",
    pattern:
      /\b(?:véritable|véritables|incontournable|incontournables|crucial|cruciale|fascinant|fascinante|révolutionnaire|inestimable|remarquable|indéniable)\b/gi,
    threshold: 4,
    instruction:
      "Réduire fortement les intensificateurs creux (véritable, incontournable, crucial, fascinant) : au plus un par article, et seulement s'il porte une information.",
  },
  {
    key: "em_dash",
    label: "Tirets cadratins en incise",
    pattern: /\s—\s/g,
    threshold: 4,
    instruction:
      "Ramener les incises au tiret cadratin à deux au maximum : ailleurs, utiliser une virgule, un point ou des parenthèses.",
  },
  {
    key: "bold_bullet",
    label: "Puces « **Terme** : définition »",
    pattern: /^[ \t]*[-*][ \t]+\*\*[^*\n]{2,60}\*\*[ \t]*(?::|—|–)/gm,
    threshold: 4,
    instruction:
      "Convertir la majorité des listes « **Terme** : définition » en paragraphes rédigés ; garder au plus une liste par article.",
  },
  {
    key: "question_heading",
    label: "Intertitres sous forme de question",
    pattern: /^#{2,4}[ \t]+[^\n?]{5,90}\?[ \t]*$/gm,
    threshold: 3,
    instruction:
      "Reformuler la plupart des intertitres interrogatifs en titres affirmatifs (les questions restantes doivent viser une requête réelle des internautes).",
  },
  {
    key: "emoji_heading",
    label: "Emoji dans les intertitres",
    pattern: /^#{1,4}[ \t]+\p{Extended_Pictographic}/gmu,
    threshold: 1,
    instruction:
      "Retirer les emoji des intertitres : ils ne correspondent pas à la ligne éditoriale HoliSwiss.",
  },
  {
    key: "triadic",
    label: "Triades rythmiques « X, Y et Z »",
    pattern: /\b\w{4,}\s*,\s*\w{4,}\s+et\s+\w{4,}\b/gi,
    threshold: 5,
    instruction:
      "Casser la cadence ternaire systématique (« X, Y et Z ») : varier le nombre d'éléments et la longueur des phrases.",
  },
];

/** Apostrophes droites et courbes mélangées : trace d'un collage machine. */
function mixedApostrophes(text: string): number {
  const curly = (text.match(/’/g) ?? []).length;
  const straight = (text.match(/(?<=\p{L})'(?=\p{L})/gu) ?? []).length;
  return curly > 0 && straight > 0 ? Math.min(curly, straight) : 0;
}

export function detectStyleTells(text: string): StyleTell[] {
  if (!text) return [];
  const found: StyleTell[] = [];

  for (const spec of TELL_SPECS) {
    const re = new RegExp(spec.pattern.source, spec.pattern.flags);
    const matches = [...text.matchAll(re)];
    if (matches.length < spec.threshold) continue;
    found.push({
      key: spec.key,
      label: spec.label,
      count: matches.length,
      instruction: spec.instruction,
      samples: matches.slice(0, 3).map((m) => m[0].trim().replace(/\s+/g, " ").slice(0, 80)),
    });
  }

  const mixed = mixedApostrophes(text);
  if (mixed > 0) {
    found.push({
      key: "mixed_apostrophes",
      label: "Apostrophes droites et courbes mélangées",
      count: mixed,
      instruction: "Uniformiser les apostrophes en apostrophe courbe (’) sur tout le texte.",
      samples: [],
    });
  }

  return found.sort((a, b) => b.count - a.count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Agrégation au niveau d'un article
// ─────────────────────────────────────────────────────────────────────────────

/** Champs texte d'un article, toutes langues. L'ordre fixe la priorité d'affichage. */
export const ARTICLE_TEXT_FIELDS = [
  "title_fr",
  "title_de",
  "title_it",
  "title_en",
  "excerpt_fr",
  "excerpt_de",
  "excerpt_it",
  "excerpt_en",
  "body_fr",
  "body_de",
  "body_it",
  "body_en",
  "meta_title_fr",
  "meta_description_fr",
  "image_alt_text",
] as const;

export type ArticleTextField = (typeof ARTICLE_TEXT_FIELDS)[number];

export type ArticleTextRecord = Partial<Record<ArticleTextField, string | null>>;

export interface AiMarksReport {
  /** Porteurs invisibles retirables sans risque. */
  invisibleCount: number;
  invisibleHits: InvisibleHit[];
  /** Champs concernés par la couche A. */
  invisibleFields: ArticleTextField[];
  /** Tics d'écriture détectés dans le corps français. */
  styleTells: StyleTell[];
  styleCount: number;
  /** Vrai si un nettoyage a quelque chose à faire. */
  dirty: boolean;
}

export function computeAiMarks(a: ArticleTextRecord): AiMarksReport {
  let invisibleCount = 0;
  const merged = new Map<string, InvisibleHit>();
  const invisibleFields: ArticleTextField[] = [];

  for (const f of ARTICLE_TEXT_FIELDS) {
    const v = a[f];
    if (typeof v !== "string" || !v) continue;
    const res = cleanInvisible(v);
    const n = res.removed + res.replaced;
    if (n === 0) continue;
    invisibleCount += n;
    invisibleFields.push(f);
    for (const h of res.hits) {
      const key = `${h.codepoint}:${h.kind}`;
      const prev = merged.get(key);
      if (prev) prev.count += h.count;
      else merged.set(key, { ...h });
    }
  }

  const styleTells = detectStyleTells(a.body_fr ?? "");
  const styleCount = styleTells.reduce((s, t) => s + t.count, 0);

  return {
    invisibleCount,
    invisibleHits: [...merged.values()].sort((x, y) => y.count - x.count),
    invisibleFields,
    styleTells,
    styleCount,
    dirty: invisibleCount > 0 || styleTells.length > 0,
  };
}

/** Applique la couche A à tous les champs texte. Rend le patch et le compte. */
export function stripInvisibleFromArticle(
  a: ArticleTextRecord,
  opts: CleanOptions = {},
): { patch: Partial<Record<ArticleTextField, string>>; removed: number; replaced: number } {
  const patch: Partial<Record<ArticleTextField, string>> = {};
  let removed = 0;
  let replaced = 0;

  for (const f of ARTICLE_TEXT_FIELDS) {
    const v = a[f];
    if (typeof v !== "string" || !v) continue;
    const res = cleanInvisible(v, opts);
    if (res.removed + res.replaced === 0) continue;
    patch[f] = res.text;
    removed += res.removed;
    replaced += res.replaced;
  }

  return { patch, removed, replaced };
}
