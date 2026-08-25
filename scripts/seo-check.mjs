#!/usr/bin/env node
/**
 * Contrôle qualité SEO — §26 et §18 du cahier des charges.
 *
 * Parcourt le sitemap en production et vérifie, sur un échantillon de chaque
 * type de page, ce qu'un crawler voit RÉELLEMENT dans le HTML initial.
 *
 * Pourquoi ce script existe : le 25/08/2026, toute la couche spécialité
 * affichait « Aucun thérapeute » en production pendant que le sitemap
 * continuait de publier ces URLs. Personne ne l'a vu — rien ne regardait. Les
 * tests unitaires ne peuvent pas attraper ça : la panne était dans les droits
 * de la base, pas dans le code.
 *
 *   npm run seo:check              échantillon de 4 URLs par type
 *   npm run seo:check -- --all     toutes les URLs du sitemap (lent)
 *   npm run seo:check -- --sample=8 --base=https://holiswiss.ch
 *
 * Sort en code 1 si une règle est violée : utilisable en CI ou en tâche
 * planifiée.
 */

const args = process.argv.slice(2);
const argVal = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : def;
};
const BASE = argVal("base", "https://holiswiss.ch").replace(/\/$/, "");
const SAMPLE = args.includes("--all") ? Infinity : Number(argVal("sample", 4));
const DELAY = Number(argVal("delay", 400));

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, redirect = "manual") {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect });
  const body = res.status >= 200 && res.status < 300 ? await res.text() : "";
  return { status: res.status, location: res.headers.get("location"), body };
}

/** Type de page, déduit du chemin — sert à échantillonner chaque famille. */
function pageType(url) {
  const p = url.slice(BASE.length);
  if (/^\/[a-z]{2}$/.test(p)) return "accueil";
  if (p.includes("/blog/categorie/")) return "catégorie";
  if (/\/evenements\/[0-9a-f-]{36}$/.test(p)) return "événement";
  if (/\/specialites\/[^/]+\/[^/]+$/.test(p)) return "spécialité × ville";
  if (p.includes("/specialites/")) return "spécialité";
  if (p.includes("/therapeutes/canton/")) return "canton";
  if (p.includes("/therapeutes/ville/")) return "ville";
  if (p.includes("/therapeutes/famille/")) return "famille";
  if (p.includes("/therapeute/")) return "fiche";
  if (p.includes("/blog/")) return "article";
  if (p.includes("/paroles/")) return "parole";
  return "statique";
}

const RE = {
  title: /<title[^>]*>([\s\S]*?)<\/title>/i,
  desc: /<meta[^>]+name="description"[^>]+content="([^"]*)"/i,
  h1: /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
  canonical: /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/gi,
  robots: /<meta[^>]+name="robots"[^>]+content="([^"]*)"/i,
  ld: /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
  internal: /href="\/[a-z]{2}\//g,
};

/** Routes qui ne doivent jamais figurer au sitemap (§18). */
const PRIVATE = ["/admin", "/dashboard", "/creer-profil", "/connexion", "/inscription", "/intake/"];

function checkPage(url, status, html) {
  const fails = [];
  if (status !== 200) {
    fails.push(`HTTP ${status}`);
    return fails; // inutile d'analyser un corps vide
  }

  const title = (html.match(RE.title)?.[1] ?? "").replace(/\s+/g, " ").trim();
  if (!title) fails.push("title vide");

  const desc = html.match(RE.desc)?.[1]?.trim() ?? "";
  if (!desc) fails.push("meta description absente");

  const h1s = [...html.matchAll(RE.h1)];
  if (h1s.length === 0) fails.push("aucun H1");
  if (h1s.length > 1) fails.push(`${h1s.length} H1 (un seul attendu)`);

  const canons = [...html.matchAll(RE.canonical)].map((m) => m[1]);
  if (canons.length === 0) fails.push("canonical absente");
  if (canons.length > 1) fails.push(`${canons.length} canonical contradictoires`);

  // §18 : une URL du sitemap doit être indexable ET canonique d'elle-même.
  const robots = html.match(RE.robots)?.[1] ?? "";
  if (/noindex/i.test(robots)) fails.push("noindex alors qu'elle est au sitemap");
  if (canons.length === 1 && canons[0].replace(/\/$/, "") !== url.replace(/\/$/, "")) {
    fails.push(`canonical pointe ailleurs (${canons[0].slice(BASE.length)})`);
  }

  for (const m of html.matchAll(RE.ld)) {
    try {
      JSON.parse(m[1]);
    } catch {
      fails.push("JSON-LD invalide");
      break;
    }
  }

  if ((html.match(RE.internal) ?? []).length === 0) fails.push("aucun lien interne");

  return fails;
}

async function main() {
  console.log(`Contrôle SEO — ${BASE}\n`);

  const sm = await fetchText(`${BASE}/sitemap.xml`, "follow");
  if (sm.status !== 200) {
    console.error(`✗ sitemap.xml inaccessible (HTTP ${sm.status})`);
    process.exit(1);
  }
  const urls = [...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  console.log(`sitemap : ${urls.length} URLs`);

  let problems = 0;

  // §18 — aucune route privée déclarée
  const leaked = urls.filter((u) => PRIVATE.some((p) => u.includes(p)));
  if (leaked.length) {
    problems += leaked.length;
    console.log(`\n✗ ${leaked.length} route(s) privée(s) au sitemap :`);
    leaked.slice(0, 5).forEach((u) => console.log(`    ${u}`));
  } else {
    console.log("✓ aucune route privée au sitemap");
  }

  // Titles dupliqués — détectés sur l'échantillon analysé
  const seenTitles = new Map();

  const byType = new Map();
  for (const u of urls) {
    const t = pageType(u);
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t).push(u);
  }

  for (const [type, list] of [...byType].sort()) {
    const sample = list.slice(0, Math.min(SAMPLE, list.length));
    const bad = [];
    for (const url of sample) {
      const { status, body } = await fetchText(url, "manual");
      const fails = checkPage(url, status, body);
      if (status === 200) {
        const title = (body.match(RE.title)?.[1] ?? "").replace(/\s+/g, " ").trim();
        if (title) {
          if (seenTitles.has(title) && seenTitles.get(title) !== url) {
            fails.push(`title identique à ${seenTitles.get(title).slice(BASE.length)}`);
          } else seenTitles.set(title, url);
        }
      }
      if (fails.length) bad.push({ url, fails });
      await sleep(DELAY);
    }
    problems += bad.length;
    const mark = bad.length === 0 ? "✓" : "✗";
    console.log(`\n${mark} ${type} — ${sample.length}/${list.length} contrôlée(s)`);
    for (const b of bad) {
      console.log(`    ${b.url.slice(BASE.length)}`);
      b.fails.forEach((f) => console.log(`      · ${f}`));
    }
  }

  console.log(`\n${problems === 0 ? "✓ aucun problème" : `✗ ${problems} page(s) en défaut`}`);
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("échec du contrôle :", e.message);
  process.exit(1);
});
