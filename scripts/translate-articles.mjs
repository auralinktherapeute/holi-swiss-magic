#!/usr/bin/env bun
/**
 * Prépare (SANS RIEN ÉCRIRE EN BASE) la traduction des variantes DE/IT/EN
 * incomplètes des articles du blog.
 *
 * Sorties, dans le dossier passé en argument (défaut /tmp/translations) :
 *   - translations.json : propositions par article/langue, à relire ;
 *   - update.sql        : UPDATE ciblés (colonnes title/excerpt/body/meta_* de
 *                         la langue visée uniquement) — à exécuter seulement
 *                         après validation explicite.
 *
 * Ne touche jamais : FR, slugs, statut, catégories, profils thérapeutes.
 * Usage : LOVABLE_API_KEY=… bun scripts/translate-articles.mjs [dossier] [--limit N]
 */
import { checkTranslation } from "../src/lib/article-translation.ts";
import { FIL_CATEGORY_SLUGS } from "../src/data/fil-holiswiss.ts";

const OUT = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "/tmp/translations";
const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || Infinity;
const URL_ = "https://qqwudmnfavvaukuldulr.supabase.co/rest/v1/articles";
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const KEY = process.env.LOVABLE_API_KEY;
if (!ANON || !KEY) throw new Error("SUPABASE_PUBLISHABLE_KEY et LOVABLE_API_KEY requis.");

const LANG_NAME = { de: "allemand de Suisse (orthographe suisse : « ss », jamais « ß »)", it: "italien de Suisse (Tessin)", en: "anglais britannique" };
const FIELDS = ["title", "excerpt", "body", "meta_title", "meta_description"];

const res = await fetch(`${URL_}?select=*&status=eq.validated`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
const rows = (await res.json()).filter((r) => !(r.category && FIL_CATEGORY_SLUGS.includes(r.category)));

async function translate(src, lang) {
  const prompt = `Traduis cet article de blog Holiswiss du français vers l'${LANG_NAME[lang]}, avec un style naturel adapté au public suisse, pas mot à mot.
Règles strictes : n'invente aucun fait, chiffre, source, certification, remboursement ni promesse médicale ; conserve le sens, les avertissements, la structure Markdown du corps et les liens internes (/fr/... devient /${lang}/...). Titres et métas sans aucun Markdown. meta_title ≤ 60 caractères, meta_description ≤ 155.
Réponds UNIQUEMENT en JSON avec les clés ${FIELDS.join(", ")}.
${JSON.stringify(src)}`;
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-2.5-pro", response_format: { type: "json_object" }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`IA HTTP ${r.status}`);
  return JSON.parse((await r.json()).choices[0].message.content);
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const out = [];
const sql = ["-- Généré par scripts/translate-articles.mjs — NE PAS EXÉCUTER sans validation.", "begin;"];
let n = 0;
for (const r of rows) {
  for (const lang of ["de", "it", "en"]) {
    if (checkTranslation(r, lang).complete || n >= LIMIT) continue;
    n++;
    const src = Object.fromEntries(FIELDS.map((f) => [f, r[`${f}_fr`] ?? ""]));
    const t = await translate(src, lang);
    const merged = { ...r, ...Object.fromEntries(FIELDS.map((f) => [`${f}_${lang}`, t[f]])) };
    const check = checkTranslation(merged, lang);
    out.push({ slug: r.slug, lang, before: Object.fromEntries(FIELDS.map((f) => [f, r[`${f}_${lang}`] ?? null])), after: t, check });
    if (check.complete) {
      sql.push(`update public.articles set ${FIELDS.map((f) => `${f}_${lang} = ${q(t[f])}`).join(", ")} where slug = ${q(r.slug)} and status = 'validated';`);
    } else {
      sql.push(`-- ${r.slug} [${lang}] écarté : ${check.reasons.join(", ")}`);
    }
    console.log(`${r.slug} [${lang}] ${check.complete ? "OK" : "à revoir"}`);
  }
}
sql.push("commit;");
await Bun.write(`${OUT}/translations.json`, JSON.stringify(out, null, 2));
await Bun.write(`${OUT}/update.sql`, sql.join("\n"));
console.log(`${n} variantes préparées → ${OUT}`);
