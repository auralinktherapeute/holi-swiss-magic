#!/usr/bin/env node
/**
 * Audit i18n : recherche les chaînes potentiellement en dur dans src/**.tsx.
 * Heuristique simple : texte JSX (>2 lettres), placeholder/title/aria-label
 * en français, hors imports/commentaires/className.
 *
 * Usage : node scripts/i18n-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("src");
const FR_HINTS = /[àâçéèêëîïôûùüœ]|(?:^|\W)(le |la |les |des |une |votre |vos |notre |nos |pour |avec |sans |dans |chez |déjà|merci|annuler|enregistrer|envoyer|chargement|erreur|bienvenue|veuillez)/i;

const SKIP_DIR = new Set(["node_modules", "integrations", "i18n", "ui"]);
const findings = [];

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name) && !e.name.endsWith(".gen.ts")) scan(p);
  }
}

function scan(file) {
  const src = fs.readFileSync(file, "utf8");
  // JSX inner text: >...< with at least 3 chars and a space or french hint
  const re = />\s*([^<>{}\n]{4,}?)\s*</g;
  let m, count = 0;
  while ((m = re.exec(src))) {
    const s = m[1].trim();
    if (!s || /^[\d\s:%·.+\-/\\]*$/.test(s)) continue;
    if (s.startsWith("{") || s.startsWith("//")) continue;
    if (!/[A-Za-zÀ-ÿ]/.test(s)) continue;
    if (!FR_HINTS.test(s) && !/\s/.test(s)) continue;
    count++;
  }
  // attribute-level
  const attrRe = /(placeholder|title|aria-label|alt)\s*=\s*"([^"]{3,})"/g;
  while ((m = attrRe.exec(src))) {
    if (FR_HINTS.test(m[2])) count++;
  }
  if (count > 0) findings.push({ file: path.relative(".", file), count });
}

walk(ROOT);
findings.sort((a, b) => b.count - a.count);
console.log(`\ni18n audit — ${findings.length} fichiers avec textes potentiellement en dur\n`);
for (const f of findings) console.log(`  ${String(f.count).padStart(4)}  ${f.file}`);
console.log("");
