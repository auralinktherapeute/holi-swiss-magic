#!/usr/bin/env node
/**
 * Génère src/data/swiss-npa.generated.ts à partir du Répertoire officiel des
 * localités de swisstopo (NPA → localité → commune → canton).
 *
 * Source (données ouvertes, libre usage avec mention de la source) :
 *   https://data.geo.admin.ch/ch.swisstopo-vd.ortschaftenverzeichnis_plz/ortschaftenverzeichnis_plz/ortschaftenverzeichnis_plz_2056.csv.zip
 *   Jeu « Amtliches Ortschaftenverzeichnis mit Postleitzahl und Perimeter ».
 *
 * Usage :
 *   curl -sSL -o /tmp/plz.zip "<url ci-dessus>" && unzip -o /tmp/plz.zip -d /tmp/plz
 *   node scripts/build-swiss-npa.mjs /tmp/plz/AMTOVZ_CSV_LV95/AMTOVZ_CSV_LV95.csv [--date AAAA-MM-JJ]
 *
 * Reproductible : même CSV (+ même --date) ⇒ fichier généré identique octet
 * pour octet. La date inscrite est celle passée en --date, à défaut la date de
 * modification du CSV (jamais « maintenant ») ; l'empreinte SHA-256 du CSV
 * figure dans l'en-tête ; le tri n'utilise que des comparaisons binaires.
 *
 * Le fichier généré est volontairement compact (texte, une ligne par couple
 * NPA × commune) et n'est chargé qu'à la demande côté navigateur.
 * Refaire tourner ce script après les fusions de communes (en général au 1er janvier).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const dateFlag = args.indexOf("--date");
const csvPath = args.find((a, i) => !a.startsWith("--") && (dateFlag < 0 || i !== dateFlag + 1));
if (!csvPath) {
  console.error("Usage : node scripts/build-swiss-npa.mjs <AMTOVZ_CSV_LV95.csv> [--date AAAA-MM-JJ]");
  process.exit(1);
}
const sourceDate = dateFlag >= 0
  ? args[dateFlag + 1]
  : fs.statSync(csvPath).mtime.toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceDate ?? "")) {
  console.error(`Date invalide : ${sourceDate}`);
  process.exit(1);
}
/** Comparaison binaire (ordre des points de code) : indépendante de la locale. */
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const CANTONS = new Set([
  "AG", "AI", "AR", "BE", "BL", "BS", "FR", "GE", "GL", "GR", "JU", "LU", "NE",
  "NW", "OW", "SG", "SH", "SO", "SZ", "TG", "TI", "UR", "VD", "VS", "ZG", "ZH",
]);

const csvBytes = fs.readFileSync(csvPath);
const sha256 = crypto.createHash("sha256").update(csvBytes).digest("hex");
const raw = csvBytes.toString("utf8").replace(/^\uFEFF/, "");
const [header, ...lines] = raw.split(/\r?\n/).filter(Boolean);
const cols = header.split(";");
const idx = (name) => {
  const i = cols.indexOf(name);
  if (i < 0) throw new Error(`Colonne absente : ${name}`);
  return i;
};
const I = {
  locality: idx("Ortschaftsname"),
  npa: idx("PLZ4"),
  commune: idx("Gemeindename"),
  bfs: idx("BFS-Nr"),
  canton: idx("Kantonskürzel"),
  share: idx("Adressenanteil"),
};

/** key = npa|bfs → { npa, commune, canton, share, localities:Set } */
const pairs = new Map();
let skipped = 0;
for (const line of lines) {
  const c = line.split(";");
  const canton = c[I.canton]?.trim();
  if (!CANTONS.has(canton)) { skipped++; continue; } // Liechtenstein, enclaves
  const npa = c[I.npa].trim();
  const bfs = c[I.bfs].trim();
  const share = parseFloat(String(c[I.share]).replace("%", "").trim()) || 0;
  const k = `${npa}|${bfs}`;
  const cur = pairs.get(k) ?? {
    npa, commune: c[I.commune].trim(), canton, share: 0, localities: new Set(),
  };
  // Part d'adresses de la commune dans ce NPA : on garde la plus forte des
  // localités (une même commune peut couvrir plusieurs localités du NPA).
  cur.share = Math.max(cur.share, share);
  cur.localities.add(c[I.locality].trim());
  pairs.set(k, cur);
}

const rows = [...pairs.values()].sort(
  (a, b) => cmp(a.npa, b.npa) || b.share - a.share || cmp(a.commune, b.commune),
);

// Format : NPA \t Commune \t Canton \t part(‰ entier) \t localités séparées par « | »
// (« = » quand la seule localité porte exactement le nom de la commune).
const out = rows.map((r) => {
  const locs = [...r.localities].sort(cmp);
  const locField = locs.length === 1 && locs[0] === r.commune ? "=" : locs.join("|");
  return [r.npa, r.commune, r.canton, Math.round(r.share * 10), locField].join("\t");
});

const target = path.resolve("src/data/swiss-npa.generated.ts");
const body = out.join("\n").replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
fs.writeFileSync(
  target,
  `/* eslint-disable */
// FICHIER GÉNÉRÉ par scripts/build-swiss-npa.mjs — ne pas éditer à la main.
// Source : swisstopo, Répertoire officiel des localités (NPA ↔ commune ↔ canton),
// https://data.geo.admin.ch/ch.swisstopo-vd.ortschaftenverzeichnis_plz/
// Extrait du ${sourceDate} — ${rows.length} couples NPA × commune.
// SHA-256 du CSV source : ${sha256}
export const SWISS_NPA_GENERATED_AT = "${sourceDate}";
export const SWISS_NPA_SOURCE_SHA256 = "${sha256}";
export const SWISS_NPA_TSV = \`${body}\`;
`,
);
console.log(`${rows.length} couples NPA × commune écrits dans ${target} (${skipped} lignes hors cantons ignorées).`);
