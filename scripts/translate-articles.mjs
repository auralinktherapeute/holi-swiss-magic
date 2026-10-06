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
 * Reprise : relancer avec le même dossier traite les N variantes suivantes.
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
  const schema = {
    type: "object",
    additionalProperties: false,
    required: FIELDS,
    properties: Object.fromEntries(FIELDS.map((f) => [f, { type: "string" }])),
  };
  const r = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Lovable-API-Key": KEY, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: prompt,
      text: { format: { type: "json_schema", name: "translation", strict: true, schema } },
    }),
  });
  if (!r.ok || !r.body) throw new Error(`IA HTTP ${r.status}`);
  // Flux SSE : on accumule les deltas de texte.
  let buf = "", text = "";
  const dec = new TextDecoder();
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const ev = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = ev.split("\n").find((l) => l.startsWith("data: "));
      if (!line || line === "data: [DONE]") continue;
      const d = JSON.parse(line.slice(6));
      if (d.type === "response.output_text.delta") text += d.delta;
      if (d.type === "response.failed" || d.type === "error") throw new Error("IA : échec de génération");
    }
  }
  return JSON.parse(text);
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
// Reprise : les variantes déjà présentes dans translations.json ne sont jamais retraitées.
const file = Bun.file(`${OUT}/translations.json`);
const out = (await file.exists()) ? await file.json() : [];
const done = new Set(out.map((x) => `${x.slug}|${x.lang}`));
const todo = [];
for (const r of rows) for (const lang of ["de", "it", "en"]) {
  if (!checkTranslation(r, lang).complete && !done.has(`${r.slug}|${lang}`)) todo.push([r, lang]);
}
const batch = todo.slice(0, LIMIT);
const save = async () => {
  const sql = ["-- Généré par scripts/translate-articles.mjs — NE PAS EXÉCUTER sans validation.", "begin;"];
  for (const x of out) {
    sql.push(x.check.complete
      ? `update public.articles set ${FIELDS.map((f) => `${f}_${x.lang} = ${q(x.after[f])}`).join(", ")} where slug = ${q(x.slug)} and status = 'validated';`
      : `-- ${x.slug} [${x.lang}] écarté : ${x.check.reasons.join(", ")}`);
  }
  sql.push("commit;");
  await Bun.write(`${OUT}/translations.json`, JSON.stringify(out, null, 2));
  await Bun.write(`${OUT}/update.sql`, sql.join("\n"));
};
// 3 traductions en parallèle ; une erreur laisse la variante « à traiter » pour le lot suivant.
for (let i = 0; i < batch.length; i += 3) {
  await Promise.all(batch.slice(i, i + 3).map(async ([r, lang]) => {
    try {
      const src = Object.fromEntries(FIELDS.map((f) => [f, r[`${f}_fr`] ?? ""]));
      const t = await translate(src, lang);
      const merged = { ...r, ...Object.fromEntries(FIELDS.map((f) => [`${f}_${lang}`, t[f]])) };
      const check = checkTranslation(merged, lang);
      out.push({ slug: r.slug, lang, before: Object.fromEntries(FIELDS.map((f) => [f, r[`${f}_${lang}`] ?? null])), after: t, check });
      console.log(`${r.slug} [${lang}] ${check.complete ? "OK" : "à revoir"}`);
    } catch (e) {
      console.log(`${r.slug} [${lang}] ERREUR ${e.message} — sera repris`);
    }
  }));
  await save();
}
await save();
console.log(`Lot terminé. Restant à traiter : ${todo.length - batch.length + batch.filter(([r, l]) => !out.some((x) => x.slug === r.slug && x.lang === l)).length} / total fichier : ${out.length}`);
