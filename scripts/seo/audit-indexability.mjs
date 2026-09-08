#!/usr/bin/env node
/**
 * Audit d'indexabilité, URL par URL.
 *
 * POURQUOI CE SCRIPT
 *   Le cycle serveur (`supabase/functions/run-indexation`) sait pousser et
 *   archiver, et depuis le 08/09 il refuse de notifier une URL morte ou
 *   `noindex`. Mais il travaille sur un LOT (40 URLs/jour) et ne juge que
 *   l'indexabilité TECHNIQUE, lisible dans la réponse HTTP.
 *
 *   Ce script travaille à froid sur TOUT le site, et va plus loin : titre, H1,
 *   volume de texte, doublons de contenu, liens internes entrants, pages
 *   orphelines, données structurées. C'est ce qui permet de séparer « Google
 *   peut l'indexer » de « Google a une raison de l'indexer ».
 *
 * CE QU'IL NE FAIT PAS
 *   Il ne prétend pas dire si une page EST indexée : seul Search Console le
 *   sait, et c'est `gsc.ts` qui le demande. Un HTTP 200 IndexNow ne prouve rien
 *   non plus. Ici on mesure l'indexABILITÉ — la capacité à être indexée — et la
 *   qualité des signaux envoyés.
 *
 * UNE SEULE PASSE
 *   Chaque URL est téléchargée UNE fois. Les liens internes sortants en sont
 *   extraits au passage, ce qui donne les entrants par simple inversion — sans
 *   second parcours du site.
 *
 * USAGE
 *   node scripts/seo/audit-indexability.mjs            # sitemap complet
 *   node scripts/seo/audit-indexability.mjs --limit 50 # échantillon
 *
 * SORTIES
 *   data/seo/indexability-audit.json
 *   data/seo/indexability-audit.csv
 *   docs/seo-indexing-audit-latest.md
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const SITE = "https://holiswiss.ch";
const UA = "holiswiss-seo-audit/1.0 (+https://holiswiss.ch)";
const CONCURRENCY = 12;
const TIMEOUT_MS = 25_000;

/** Seuil de contenu en dessous duquel une page est jugée mince. */
const THIN_WORDS = 250;
/** Seuils d'un titre raisonnable, en caractères. */
const TITLE_MIN = 15;
const TITLE_MAX = 65;

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : Infinity;

// ── Récupération du périmètre ────────────────────────────────────────────────

async function fetchSitemap() {
  const r = await fetch(`${SITE}/sitemap.xml`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`sitemap HTTP ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
}

async function fetchRobots() {
  try {
    const r = await fetch(`${SITE}/robots.txt`, { headers: { "User-Agent": UA } });
    if (!r.ok) return [];
    // Règles du groupe « * » uniquement : c'est celui qui régit Googlebot ici.
    const lines = (await r.text()).split("\n").map((l) => l.trim());
    const out = [];
    let inStar = false;
    for (const l of lines) {
      if (/^user-agent:/i.test(l)) inStar = /:\s*\*\s*$/.test(l);
      else if (inStar && /^disallow:/i.test(l)) {
        const p = l.split(":").slice(1).join(":").trim();
        if (p) out.push(p);
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Le chemin est-il interdit par une règle Disallow (motif `*` simplifié) ? */
function blockedByRobots(pathname, rules) {
  return rules.some((rule) => {
    const rx = new RegExp(
      "^" + rule.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*"),
    );
    return rx.test(pathname);
  });
}

// ── Analyse d'une page ───────────────────────────────────────────────────────

function textOf(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(html, re) {
  return html.match(re)?.[1] ?? null;
}

async function auditOne(url, robotsRules) {
  const base = {
    url,
    url_type: classify(url),
    http_status: null,
    final_url: null,
    redirect_count: 0,
    robots_status: blockedByRobots(new URL(url).pathname, robotsRules) ? "disallowed" : "allowed",
    x_robots_tag: null,
    meta_robots: null,
    canonical: null,
    canonical_matches_url: null,
    title: null,
    title_length: 0,
    meta_description_present: false,
    h1_present: false,
    h1_count: 0,
    content_word_count: 0,
    schema_types: [],
    internal_outlinks: [],
    error: null,
  };

  let resp;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    return { ...base, http_status: "ERR", error: String(e.message ?? e).slice(0, 120) };
  }

  base.http_status = resp.status;
  base.final_url = resp.url;
  base.redirect_count = resp.redirected ? 1 : 0;
  base.x_robots_tag = resp.headers.get("x-robots-tag");

  if (resp.status !== 200) return base;

  const html = await resp.text();
  base.meta_robots =
    attr(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i) ??
    attr(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i);
  base.canonical = attr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["']/i);
  base.canonical_matches_url = base.canonical
    ? base.canonical.replace(/\/+$/, "") === url.replace(/\/+$/, "")
    : false;
  base.title = attr(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.trim() ?? null;
  base.title_length = base.title?.length ?? 0;
  base.meta_description_present = /<meta[^>]+name=["']description["']/i.test(html);
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)];
  base.h1_count = h1s.length;
  base.h1_present = h1s.length > 0;
  base.content_word_count = textOf(html).split(" ").filter(Boolean).length;
  base.schema_types = [...html.matchAll(/"@type"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);

  // Liens internes sortants, pour reconstituer les entrants sans second passage.
  const links = new Set();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#?]+)/gi)) {
    const href = m[1];
    if (href.startsWith("/")) links.add(SITE + href.replace(/\/+$/, ""));
    else if (href.startsWith(SITE)) links.add(href.replace(/\/+$/, ""));
  }
  base.internal_outlinks = [...links];

  return base;
}

function classify(url) {
  const p = url.replace(SITE, "");
  if (/^\/[a-z]{2}\/therapeute\//.test(p)) return "therapist";
  if (/^\/[a-z]{2}\/?$/.test(p)) return "home";
  if (/^\/[a-z]{2}\/therapeutes(\/|$)/.test(p)) return "listing";
  if (/^\/[a-z]{2}\/specialites\//.test(p)) return "specialty";
  if (/^\/[a-z]{2}\/blog(\/|$)/.test(p)) return "article";
  if (/^\/[a-z]{2}\/evenements\//.test(p)) return "event";
  if (/^\/[a-z]{2}\/paroles\//.test(p)) return "parole";
  return "static";
}

// ── Classification ───────────────────────────────────────────────────────────

/**
 * Une seule catégorie principale par URL, dans l'ordre de gravité : ce qui
 * BLOQUE prime sur ce qui est faible, qui prime sur ce qui est bon.
 */
function classifyIndexability(r, inSitemap, inlinks, dupTitle) {
  const blocking = [];
  if (r.http_status === "ERR") blocking.push(`injoignable (${r.error})`);
  else if (r.http_status === 404 || r.http_status === 410) blocking.push(`HTTP ${r.http_status}`);
  else if (r.http_status !== 200) blocking.push(`HTTP ${r.http_status}`);
  if (r.redirect_count > 0) blocking.push(`redirige vers ${r.final_url}`);
  if (r.robots_status === "disallowed") blocking.push("bloquée par robots.txt");
  if (r.x_robots_tag && /noindex/i.test(r.x_robots_tag)) blocking.push("X-Robots-Tag noindex");
  if (r.meta_robots && /noindex/i.test(r.meta_robots)) blocking.push("meta robots noindex");
  if (r.canonical && !r.canonical_matches_url) blocking.push(`canonical → ${r.canonical}`);
  if (r.http_status === 200 && !r.canonical) blocking.push("canonical absente");

  const quality = [];
  if (r.content_word_count < THIN_WORDS) quality.push(`contenu mince (${r.content_word_count} mots)`);
  if (!r.title) quality.push("title absent");
  else if (r.title_length < TITLE_MIN || r.title_length > TITLE_MAX) {
    quality.push(`title ${r.title_length} car.`);
  }
  if (!r.meta_description_present) quality.push("meta description absente");
  if (!r.h1_present) quality.push("H1 absent");
  else if (r.h1_count > 1) quality.push(`${r.h1_count} H1`);
  if (inlinks === 0) quality.push("orpheline (0 lien interne entrant)");
  if (dupTitle) quality.push("title dupliqué");

  // Un noindex/canonical délibéré n'est pas une panne : c'est une décision.
  const deliberate =
    (r.meta_robots && /noindex/i.test(r.meta_robots)) ||
    (r.canonical && !r.canonical_matches_url && r.http_status === 200);

  let category;
  if (blocking.length > 0) {
    category = deliberate && r.http_status === 200
      ? "NON_INDEXABLE_VOLONTAIRE"
      : "BLOQUEE_TECHNIQUEMENT";
  } else if (dupTitle) {
    category = "A_DEDUPLIQUER_OU_CONSOLIDER";
  } else if (quality.length > 0) {
    category = "INDEXABLE_MAIS_A_AMELIORER";
  } else {
    category = "INDEXABLE_ET_PRIORITAIRE";
  }

  const priority =
    category === "INDEXABLE_ET_PRIORITAIRE" && r.url_type === "therapist" ? 1
      : category === "INDEXABLE_ET_PRIORITAIRE" ? 2
      : category === "BLOQUEE_TECHNIQUEMENT" ? 1
      : category === "INDEXABLE_MAIS_A_AMELIORER" ? 3
      : 4;

  let action = "aucune";
  if (category === "BLOQUEE_TECHNIQUEMENT") action = "corriger le blocage avant toute soumission";
  else if (category === "NON_INDEXABLE_VOLONTAIRE") action = "retirer du sitemap et de la file";
  else if (category === "A_DEDUPLIQUER_OU_CONSOLIDER") action = "canonicaliser ou différencier le contenu";
  else if (category === "INDEXABLE_MAIS_A_AMELIORER") action = "enrichir avant de pousser";
  else if (!inSitemap) action = "ajouter au sitemap";

  return {
    indexability_status: category,
    blocking_reason: blocking.join(" ; "),
    quality_flags: quality.join(" ; "),
    recommended_action: action,
    priority,
  };
}

// ── Exécution ────────────────────────────────────────────────────────────────

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
        if (idx % 25 === 0) process.stderr.write(`\r  ${idx + 1}/${items.length}`);
      }
    }),
  );
  process.stderr.write("\r");
  return out;
}

async function save(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  console.log(`  écrit : ${path}`);
}

const CSV_COLS = [
  "url", "url_type", "http_status", "final_url", "redirect_count", "robots_status",
  "x_robots_tag", "meta_robots", "canonical", "canonical_matches_url", "in_sitemap",
  "sitemap_indexable", "title", "title_length", "meta_description_present", "h1_present",
  "content_word_count", "internal_inlinks", "orphan_status", "render_mode",
  "schema_validity", "indexability_status", "blocking_reason", "quality_flags",
  "recommended_action", "priority",
];

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""').replace(/\n/g, " ")}"`;
}

async function main() {
  console.log("Audit d'indexabilité — holiswiss.ch\n");

  const [sitemapUrls, robotsRules] = await Promise.all([fetchSitemap(), fetchRobots()]);
  const sitemapSet = new Set(sitemapUrls.map((u) => u.replace(/\/+$/, "")));
  console.log(`  sitemap : ${sitemapUrls.length} URLs · robots.txt : ${robotsRules.length} règles Disallow`);

  const targets = sitemapUrls.slice(0, LIMIT);
  const partial = targets.length < sitemapUrls.length;
  if (partial) {
    // Les entrants se déduisent des sortants des pages TÉLÉCHARGÉES. Sur un
    // échantillon, une page peut paraître orpheline simplement parce que la
    // page qui la lie n'a pas été visitée. Ne pas conclure sur `--limit`.
    console.warn(
      `  ⚠️  échantillon partiel : « orpheline » n'est PAS fiable ici ` +
        `(liens entrants calculés sur ${targets.length}/${sitemapUrls.length} pages seulement)`,
    );
  }
  console.log(`  analyse de ${targets.length} URLs (concurrence ${CONCURRENCY})…`);
  const raw = await mapLimit(targets, CONCURRENCY, (u) => auditOne(u, robotsRules));

  // Liens entrants, par inversion des sortants — pas de second parcours.
  const inlinks = new Map(targets.map((u) => [u.replace(/\/+$/, ""), 0]));
  for (const r of raw) {
    for (const out of r.internal_outlinks ?? []) {
      const k = out.replace(/\/+$/, "");
      if (inlinks.has(k) && k !== r.url.replace(/\/+$/, "")) inlinks.set(k, inlinks.get(k) + 1);
    }
  }

  // Titres dupliqués — signal de pages programmatiques non différenciées.
  const titleCount = new Map();
  for (const r of raw) {
    if (r.title) titleCount.set(r.title, (titleCount.get(r.title) ?? 0) + 1);
  }

  const rows = raw.map((r) => {
    const key = r.url.replace(/\/+$/, "");
    const nIn = inlinks.get(key) ?? 0;
    const dup = r.title ? titleCount.get(r.title) > 1 : false;
    const cls = classifyIndexability(r, sitemapSet.has(key), nIn, dup);
    return {
      ...r,
      in_sitemap: sitemapSet.has(key),
      sitemap_indexable: sitemapSet.has(key) && cls.indexability_status.startsWith("INDEXABLE"),
      internal_inlinks: nIn,
      orphan_status: nIn === 0 ? "orpheline" : "liée",
      // Le HTML initial porte-t-il déjà le contenu ? (SSR effectif)
      render_mode: r.content_word_count > 100 && r.title ? "SSR" : "vide/CSR",
      schema_validity: r.schema_types?.length ? `${r.schema_types.length} types` : "aucun",
      ...cls,
    };
  });

  // ── Sorties ────────────────────────────────────────────────────────────────
  await save("data/seo/indexability-audit.json", JSON.stringify(rows, null, 1));
  await save(
    "data/seo/indexability-audit.csv",
    [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => csvCell(r[c])).join(","))].join("\n"),
  );

  const byCat = {};
  for (const r of rows) (byCat[r.indexability_status] ??= []).push(r);
  const byType = {};
  for (const r of rows) {
    (byType[r.url_type] ??= { n: 0, ok: 0 }).n++;
    if (r.indexability_status === "INDEXABLE_ET_PRIORITAIRE") byType[r.url_type].ok++;
  }

  const problems = [
    ["HTTP non 200", rows.filter((r) => r.http_status !== 200).length],
    ["redirections", rows.filter((r) => r.redirect_count > 0).length],
    ["meta robots noindex", rows.filter((r) => r.meta_robots && /noindex/i.test(r.meta_robots)).length],
    ["canonical vers une autre URL", rows.filter((r) => r.canonical && !r.canonical_matches_url).length],
    ["canonical absente", rows.filter((r) => r.http_status === 200 && !r.canonical).length],
    ["orphelines (0 lien entrant)", rows.filter((r) => r.internal_inlinks === 0).length],
    [`contenu mince (< ${THIN_WORDS} mots)`, rows.filter((r) => r.content_word_count < THIN_WORDS).length],
    ["title dupliqué", rows.filter((r) => r.quality_flags.includes("title dupliqué")).length],
    ["H1 absent", rows.filter((r) => !r.h1_present).length],
    ["rendu vide / CSR", rows.filter((r) => r.render_mode !== "SSR").length],
  ].sort((a, b) => b[1] - a[1]);

  const md = `# Audit d'indexabilité — ${new Date().toISOString().slice(0, 10)}

Généré par \`scripts/seo/audit-indexability.mjs\`. **${rows.length} URLs** analysées, une par une,
depuis le sitemap en ligne.

> Cet audit mesure l'**indexabilité** — la capacité d'une page à être indexée — et la qualité des
> signaux qu'elle envoie. Il ne dit PAS si une page est indexée : seul Search Console le sait.
> Un HTTP 200 d'IndexNow ne prouve rien non plus.

## Classification

| Catégorie | URLs | Part |
|---|---:|---:|
${Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)
  .map(([k, v]) => `| ${k} | ${v.length} | ${Math.round((100 * v.length) / rows.length)} % |`).join("\n")}

## Par type de page

| Type | URLs | Indexables et prioritaires |
|---|---:|---:|
${Object.entries(byType).sort((a, b) => b[1].n - a[1].n)
  .map(([k, v]) => `| ${k} | ${v.n} | ${v.ok} |`).join("\n")}

## Top problèmes

| Problème | URLs |
|---|---:|
${problems.filter(([, n]) => n > 0).map(([k, n]) => `| ${k} | ${n} |`).join("\n")}

## URLs bloquées techniquement

${(byCat.BLOQUEE_TECHNIQUEMENT ?? []).slice(0, 40)
  .map((r) => `- \`${r.url.replace(SITE, "")}\` — ${r.blocking_reason}`).join("\n") || "_aucune_"}

## À dédupliquer ou consolider

${(byCat.A_DEDUPLIQUER_OU_CONSOLIDER ?? []).slice(0, 30)
  .map((r) => `- \`${r.url.replace(SITE, "")}\` — ${r.quality_flags}`).join("\n") || "_aucune_"}

## Ce que le fichier détaillé contient

\`data/seo/indexability-audit.csv\` — une ligne par URL, ${CSV_COLS.length} colonnes :
statut HTTP, redirections, robots, canonical, title, H1, volume de contenu, liens entrants,
mode de rendu, catégorie, raison de blocage, signaux de qualité, action recommandée, priorité.
`;
  await save("docs/seo-indexing-audit-latest.md", md);

  console.log("\n── Résumé ──");
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${k.padEnd(30)} ${String(v.length).padStart(4)}`);
  }
  console.log("\n── Top problèmes ──");
  for (const [k, n] of problems.filter(([, n]) => n > 0)) {
    console.log(`  ${k.padEnd(34)} ${String(n).padStart(4)}`);
  }
}

main().catch((e) => {
  console.error("échec :", e);
  process.exit(1);
});
