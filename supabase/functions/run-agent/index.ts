// Edge Function universelle — The Summer Delegation
// Deux modes :
//   { agent_slug }             -> lancement manuel simple d'un agent (routine/cron), inchangé pour l'admin
//   { delegation_request_id }  -> pipeline complet : comprendre -> router -> déléguer -> vérifier -> synthétiser
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY") ?? "";
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CANTON_LANG: Record<string, string> = {
  VD: "fr", GE: "fr", NE: "fr", JU: "fr", FR: "fr", VS: "fr",
  ZH: "de", BE: "de", BS: "de", BL: "de", AG: "de", TG: "de",
  SG: "de", SH: "de", AR: "de", AI: "de", GL: "de", ZG: "de",
  LU: "de", UR: "de", SZ: "de", OW: "de", NW: "de", SO: "de", GR: "de",
  TI: "it",
};
function cantonToLang(canton: string | null): string {
  if (!canton) return "fr";
  return CANTON_LANG[canton.toUpperCase()] ?? "fr";
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

async function mistral(prompt: string, model = "mistral-small-latest"): Promise<string> {
  if (!MISTRAL_API_KEY) throw new Error("MISTRAL_API_KEY non configurée");
  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${MISTRAL_API_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.7, max_tokens: 3000 }),
  });
  if (!res.ok) throw new Error(`Mistral error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

function parseJsonOrThrow(raw: string): Record<string, unknown> {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse Mistral non-JSON");
  return JSON.parse(match[0]);
}

async function getAgent(slug: string) {
  const { data } = await db.from("ai_agents").select("*").eq("slug", slug).single();
  return data;
}

// ═══════════════════════════════════════════════════════════════
//  LANCEMENT MANUEL SIMPLE — logs legacy sur ai_agent_logs/ai_agents
// ═══════════════════════════════════════════════════════════════
async function logSuccess(agentId: string, slug: string, output: unknown, startedAt: Date, notes?: string) {
  const duration = Date.now() - startedAt.getTime();
  await Promise.all([
    db.from("ai_agent_logs").insert({
      agent_id: agentId, agent_slug: slug, status: "success", level: "info",
      started_at: startedAt.toISOString(), finished_at: new Date().toISOString(),
      duration_ms: duration, output, triggered_by: "manual",
      message: notes ?? `Agent ${slug} exécuté avec succès`,
    }),
    db.from("ai_agents").update({
      status: "actif", last_run_at: new Date().toISOString(),
      last_run_status: "success", updated_at: new Date().toISOString(),
    }).eq("id", agentId),
  ]);
}

async function logError(agentId: string, slug: string, error: string, startedAt: Date) {
  const duration = Date.now() - startedAt.getTime();
  await Promise.all([
    db.from("ai_agent_logs").insert({
      agent_id: agentId, agent_slug: slug, status: "error", level: "info",
      started_at: startedAt.toISOString(), finished_at: new Date().toISOString(),
      duration_ms: duration, error_message: error, triggered_by: "manual",
      message: `Agent ${slug} — erreur: ${error}`,
    }),
    db.from("ai_agents").update({
      status: "error", last_run_at: new Date().toISOString(),
      last_run_status: "error", updated_at: new Date().toISOString(),
    }).eq("id", agentId),
  ]);
}

const SECURITY_CRITICAL_TABLES = [
  "therapists", "articles", "subscriptions", "invoices", "ai_agents",
  "delegation_config", "moderation_queue", "seo_geo_reports", "email_templates",
];

// ─── Le Coordinateur — collecte + rapport (routine cron + phase 1 du pipeline)
async function runCoordinateur(agent: Record<string, unknown>, startedAt: Date) {
  const { data: logs } = await db.from("ai_agent_logs")
    .select("agent_slug,status,message,started_at")
    .gte("started_at", new Date(Date.now() - 86400000).toISOString())
    .order("started_at", { ascending: false }).limit(100);
  const { data: therapeutes } = await db.from("therapists").select("canton,status").eq("status", "active");
  const byRegion = { fr: 0, de: 0, it: 0, en: 0 };
  (therapeutes ?? []).forEach((t: { canton: string | null }) => {
    const l = cantonToLang(t.canton);
    if (l in byRegion) byRegion[l as keyof typeof byRegion]++; else byRegion.en++;
  });
  const total = (therapeutes ?? []).length;
  const pct = Math.round((total / 100) * 100);
  const daysLeft = Math.max(0, Math.ceil((new Date("2026-11-24").getTime() - Date.now()) / 86400000));
  const success = (logs ?? []).filter((l: { status: string }) => l.status === "success").length;
  const errors = (logs ?? []).filter((l: { status: string }) => l.status === "error").length;
  const agentsSeen = [...new Set((logs ?? []).map((l: { agent_slug: string }) => l.agent_slug))];
  const rapport = `🏛️ RAPPORT DÉLÉGATION — ${new Date().toLocaleDateString("fr-CH")}
📊 Progression : ${total}/100 thérapeutes (${pct}%) — J-${daysLeft} avant le 24 nov. 2026
🇫🇷 Romands : ${byRegion.fr} | 🇩🇪 Alémaniques : ${byRegion.de} | 🇮🇹 Tessinois : ${byRegion.it} | 🌍 EN : ${byRegion.en}

AGENTS ACTIFS (24h) : ${agentsSeen.join(", ") || "aucun"}
SUCCÈS : ${success} opérations
ALERTES : ${errors} erreur(s)

⚡ ACTION : ${total < 10 ? "Lancer une campagne de recrutement Suisse romande" : "Maintenir la cadence — 5 inscriptions/semaine"}`;
  await logSuccess(agent.id as string, agent.slug as string, { rapport, total, byRegion }, startedAt, rapport);
  return { rapport, total, byRegion, daysLeft };
}

async function runCoordinateurIA(agent: Record<string, unknown>, startedAt: Date) {
  const brut = await runCoordinateur(agent, startedAt);
  if (!MISTRAL_API_KEY) return brut;
  const prompt = `Tu es Le Coordinateur de The Summer Delegation — Holiswiss.ch.
Données du jour : ${brut.total}/100 thérapeutes (J-${brut.daysLeft}), Romands ${brut.byRegion.fr}, Alémaniques ${brut.byRegion.de}, Tessinois ${brut.byRegion.it}, EN ${brut.byRegion.en}.
Génère un rapport synthétique en 10 lignes MAX en français pour Gérald. Inclus progression, analyse par région, 1 action prioritaire concrète.`;
  const rapport = await mistral(prompt);
  await db.from("ai_agent_logs").insert({
    agent_id: agent.id as string, agent_slug: agent.slug as string, status: "success", level: "info",
    started_at: startedAt.toISOString(), finished_at: new Date().toISOString(),
    output: { rapport, ...brut }, triggered_by: "manual", message: rapport.slice(0, 200),
  });
  return { rapport, ...brut };
}

// ─── Agent Recrutement — tracker objectif 100 thérapeutes (routine, hors pipeline)
async function runRecrutement(agent: Record<string, unknown>, startedAt: Date) {
  const { data: therapeutes, count } = await db.from("therapists").select("canton,created_at", { count: "exact" }).eq("status", "active");
  const total = count ?? 0;
  const pct = Math.round((total / 100) * 100);
  const weeksLeft = Math.max(1, Math.ceil((new Date("2026-11-24").getTime() - Date.now()) / (7 * 86400000)));
  const rythmeNecessaire = Math.ceil((100 - total) / weeksLeft);
  const recent = (therapeutes ?? []).filter((t: { created_at: string }) => t.created_at > new Date(Date.now() - 28 * 86400000).toISOString());
  const rythmeActuel = Math.round(recent.length / 4);
  const byRegion = { fr: 0, de: 0, it: 0, en: 0 };
  (therapeutes ?? []).forEach((t: { canton: string | null }) => {
    const l = cantonToLang(t.canton);
    if (l in byRegion) byRegion[l as keyof typeof byRegion]++; else byRegion.en++;
  });
  const alerte = rythmeActuel < rythmeNecessaire;
  const rapport = {
    total, objectif: 100, pct, weeksLeft, rythmeNecessaire, rythmeActuel, byRegion, alerte,
    message: alerte
      ? `⚠️ Rythme insuffisant ! ${rythmeActuel}/sem vs ${rythmeNecessaire}/sem nécessaires.`
      : `✅ Rythme suffisant (${rythmeActuel}/sem).`,
  };
  await logSuccess(agent.id as string, agent.slug as string, rapport, startedAt, `Progression ${total}/100 (${pct}%)`);
  return rapport;
}

async function runRecrutementIA(agent: Record<string, unknown>, startedAt: Date) {
  const brut = await runRecrutement(agent, startedAt);
  if (!MISTRAL_API_KEY || !brut.alerte) return brut;
  const prompt = `Agent Recrutement Holiswiss.ch. Situation : ${brut.total}/100 (${brut.pct}%), ${brut.weeksLeft} semaines restantes. Rythme actuel ${brut.rythmeActuel}/sem vs ${brut.rythmeNecessaire} nécessaire. Génère 3 actions correctives concrètes, 1 ligne par action.`;
  const actions = await mistral(prompt);
  return { ...brut, actionsCorrectivesIA: actions };
}

// ─── Agent Sécurité / RLS
async function runSecurite(agent: Record<string, unknown>, startedAt: Date) {
  const rapport = await produceSecurityRls("Audit de sécurité général (lancement manuel)");
  await logSuccess(agent.id as string, agent.slug as string, rapport, startedAt, (rapport as Record<string, unknown>).message as string);
  return rapport;
}

// ─── Agent Articles GEO / Copywriting
// BUG CORRIGÉ : article_suggestions n'a pas de colonnes title_fr/slug (seulement
// sujet/categorie/requete_geo/priorite/status) — l'ancienne version comparait donc
// toujours `undefined`, sélectionnait systématiquement la 1re ligne de la table et
// retombait sur le sujet générique "Bien-être holistique en Suisse" à chaque run.
async function runArticlesGeo(agent: Record<string, unknown>, startedAt: Date) {
  // AUDIT DE DIVERSITÉ — on ne dédoublonne plus seulement la CATÉGORIE mais aussi le
  // THÈME. Sinon « Remboursement massage », « Assurances-remboursement ostéo » et
  // « Remboursement naturopathie » passent tous (catégories différentes, même sujet).
  const { data: existants } = await db.from("articles")
    .select("category,title_fr").order("created_at", { ascending: false }).limit(80);
  const rows = (existants ?? []) as Array<{ category: string | null; title_fr: string | null }>;
  const catCount: Record<string, number> = {};
  for (const a of rows) { const c = (a.category ?? "").trim(); if (c) catCount[c] = (catCount[c] ?? 0) + 1; }
  const recentTitles = rows.map((a) => (a.title_fr ?? "").toLowerCase()).filter(Boolean);

  // Thèmes récurrents à plafonner (mots-clés). Un thème est « saturé » s'il apparaît
  // déjà dans ≥ 3 titres récents.
  const THEMES: Array<[string, string[]]> = [
    ["remboursement", ["remboursement", "assurance", "lamal", "asca", "rme"]],
    ["douleur", ["douleur", "cervical", "sciatique", "tendinite", "hernie", "articulaire", "dos"]],
  ];
  const themeSaturated = (sujet: string): boolean => {
    const s = (sujet ?? "").toLowerCase();
    return THEMES.some(([, kw]) => {
      if (!kw.some((k) => s.includes(k))) return false;
      return recentTitles.filter((t) => kw.some((k) => t.includes(k))).length >= 3;
    });
  };
  const catSaturated = (cat: string): boolean => (catCount[(cat ?? "").trim()] ?? 0) >= 3;
  const sujetOf = (s: { sujet?: string; requete_geo?: string }) => s.sujet ?? s.requete_geo ?? "";

  const { data: suggestions } = await db.from("article_suggestions")
    .select("*").eq("status", "pending").order("priorite", { ascending: true }).limit(30);
  const pend = (suggestions ?? []) as Array<{ id: string; sujet?: string; requete_geo?: string; categorie?: string }>;

  // Sélection par ordre de préférence : catégorie ET thème non saturés → puis replis.
  const dispo =
    pend.find((s) => !catSaturated(s.categorie ?? "") && !themeSaturated(sujetOf(s))) ??
    pend.find((s) => !catSaturated(s.categorie ?? "")) ??
    pend.find((s) => !themeSaturated(sujetOf(s))) ??
    pend[0];

  if (!dispo) {
    await logSuccess(agent.id as string, agent.slug as string, { message: "Aucun sujet disponible" }, startedAt, "Aucune suggestion pending");
    return { message: "Aucun sujet disponible" };
  }

  const sujet = dispo.sujet ?? dispo.requete_geo ?? "Bien-être holistique en Suisse";
  const article = await produceArticleContent(sujet, recentTitles.slice(0, 12));

  const { data: inserted, error } = await db.from("articles").insert({
    title_fr: article.title_fr, title_de: article.title_de, title_it: article.title_it, title_en: article.title_en,
    excerpt_fr: article.excerpt_fr, excerpt_de: article.excerpt_de, excerpt_it: article.excerpt_it, excerpt_en: article.excerpt_en,
    body_fr: article.body_fr, body_de: article.body_de, body_it: article.body_it, body_en: article.body_en,
    meta_title_fr: article.meta_title_fr, meta_title_de: article.meta_title_de,
    meta_description_fr: article.meta_description_fr, meta_description_de: article.meta_description_de,
    slug: article.slug, category: article.category ?? dispo.categorie ?? "bien-etre", status: "draft", lang: "fr",
  }).select().single();
  if (error) throw new Error(`INSERT article: ${error.message}`);

  await db.from("article_suggestions").update({ status: "used" }).eq("id", dispo.id);

  await logSuccess(agent.id as string, agent.slug as string,
    { article_id: inserted.id, slug: article.slug, title_fr: article.title_fr }, startedAt,
    `✅ Article 4L généré : "${article.title_fr}" → draft`);
  return { article_id: inserted.id, slug: article.slug };
}

async function produceArticleContent(sujet: string, recentTitles: string[] = []): Promise<Record<string, string>> {
  const eviter = recentTitles.length
    ? `\nÉVITE de répéter l'angle ou le thème de ces articles récents :\n- ${recentTitles.join("\n- ")}\nSi le sujet touche au remboursement/assurance déjà couvert, traite-le sous un angle nouveau.`
    : "";
  const prompt = `Expert SEO/GEO Holiswiss.ch. Génère article EN 4 LANGUES sur : "${sujet}"
900-1200 mots/langue, H2/H3, entités suisses, FAQ 5 Q/R.${eviter}
JSON : {"title_fr":"...","title_de":"...","title_it":"...","title_en":"...","excerpt_fr":"...","excerpt_de":"...","excerpt_it":"...","excerpt_en":"...","body_fr":"markdown...","body_de":"...","body_it":"...","body_en":"...","meta_title_fr":"60ch","meta_title_de":"60ch","meta_description_fr":"155ch","meta_description_de":"155ch","slug":"slug-fr","category":"bien-etre"}`;
  const raw = await mistral(prompt);
  return parseJsonOrThrow(raw) as Record<string, string>;
}

// ─── Agent Social Media (absorbé conceptuellement par copywriting, gardé en manuel)
async function runSocial(agent: Record<string, unknown>, startedAt: Date) {
  const { data: lastArticle } = await db.from("articles")
    .select("title_fr,title_de,title_it,title_en,slug").eq("status", "published")
    .order("published_at", { ascending: false }).limit(1).single();
  if (!lastArticle) {
    await logSuccess(agent.id as string, agent.slug as string, { message: "Aucun article publié" }, startedAt, "Aucun article");
    return { message: "Aucun article publié" };
  }
  const prompt = `Agent Social Media Holiswiss.ch. Article : FR="${lastArticle.title_fr}" | DE="${lastArticle.title_de}" | IT="${lastArticle.title_it}" | EN="${lastArticle.title_en}"
Génère 3 posts PAR LANGUE (12 total) : Instagram + TikTok + LinkedIn.
JSON : {"instagram_fr":"...","instagram_de":"...","instagram_it":"...","instagram_en":"...","tiktok_fr":"...","tiktok_de":"...","tiktok_it":"...","tiktok_en":"...","linkedin_fr":"...","linkedin_de":"...","linkedin_it":"...","linkedin_en":"..."}`;
  const raw = await mistral(prompt);
  const posts = parseJsonOrThrow(raw);
  await logSuccess(agent.id as string, agent.slug as string, { posts, source_article: lastArticle.slug }, startedAt, `✅ 12 posts générés (4L × 3 formats)`);
  return { posts, source: lastArticle.slug };
}

// ─── Agent FAQ SEO (déprécié, fusionné dans seo_geo — gardé pour compat manuelle)
async function runFaqSeo(agent: Record<string, unknown>, startedAt: Date) {
  const { data: article } = await db.from("articles").select("id,title_fr").eq("status", "published")
    .order("published_at", { ascending: false }).limit(1).single();
  if (!article) {
    await logSuccess(agent.id as string, agent.slug as string, { message: "Aucun article" }, startedAt, "Aucun article");
    return { message: "Aucun article" };
  }
  const prompt = `Agent FAQ SEO Holiswiss.ch. Article : "${article.title_fr}"
Génère 6 Q/R EN 4 LANGUES (24 total), 40-80 mots/réponse.
JSON : {"faq_fr":[{"q":"...","a":"..."},...],"faq_de":[...],"faq_it":[...],"faq_en":[...]}`;
  const raw = await mistral(prompt);
  const faqs = parseJsonOrThrow(raw);
  await logSuccess(agent.id as string, agent.slug as string, { article_id: article.id, faqs }, startedAt, `✅ FAQ 4L générée (24 Q/R)`);
  return { article_id: article.id, faqs };
}

// ─── Agent SEO Audit (déprécié, fusionné dans seo_geo — gardé pour compat manuelle)
async function runSeoAudit(agent: Record<string, unknown>, startedAt: Date) {
  const { data: articles } = await db.from("articles")
    .select("id,slug,title_fr,body_fr,body_de,body_it,body_en,meta_description_fr,meta_description_de").eq("status", "published");
  if (!articles?.length) {
    await logSuccess(agent.id as string, agent.slug as string, { message: "Aucun article" }, startedAt, "Aucun article");
    return { message: "Aucun article" };
  }
  const scores = articles.map((a: Record<string, string | null>) => {
    let score = 0;
    for (const lang of ["fr", "de", "it", "en"]) {
      const body = a[`body_${lang}`] ?? "";
      if (body.length > 500) { score++; if (body.includes("##")) score++; if (body.toLowerCase().includes("holiswiss")) score++; }
    }
    const mfr = a["meta_description_fr"] ?? ""; if (mfr.length > 50 && mfr.length <= 155) score++;
    const mde = a["meta_description_de"] ?? ""; if (mde.length > 50 && mde.length <= 155) score++;
    return { slug: a.slug, title: a.title_fr, scoreSur10: Math.min(10, score) };
  });
  scores.sort((a: { scoreSur10: number }, b: { scoreSur10: number }) => a.scoreSur10 - b.scoreSur10);
  await logSuccess(agent.id as string, agent.slug as string, { scores, articlesAudites: articles.length }, startedAt, `✅ ${articles.length} articles audités`);
  return { scores };
}

// ─── Agent SEO/GEO — lancement manuel, réutilise le producteur du pipeline
async function runSeoGeoManual(agent: Record<string, unknown>, startedAt: Date) {
  const rapport = await produceSeoGeo("Audit SEO/GEO général des articles publiés (lancement manuel)");
  await logSuccess(agent.id as string, agent.slug as string, rapport, startedAt, `✅ Rapport SEO/GEO généré`);
  return rapport;
}

// ─── Agent Email — utilise/alimente le cache email_templates
async function runEmail(agent: Record<string, unknown>, startedAt: Date) {
  const { data: therapeutes } = await db.from("therapists").select("id,first_name,email,canton").neq("status", "active").limit(10);
  if (!therapeutes?.length) {
    await logSuccess(agent.id as string, agent.slug as string, { message: "Aucun thérapeute en attente" }, startedAt, "0 en attente");
    return { message: "Aucun thérapeute en attente" };
  }

  const { data: template } = await db.from("email_templates")
    .select("*").eq("slug", "relance-profil-incomplet").eq("is_active", true).maybeSingle();

  let cachedFr: { sujet: string; corps: string } | null = null;
  const emailsGeneres: Array<{ email: string; sujet: string; corps: string; langue: string }> = [];

  for (const t of therapeutes) {
    const lang = cantonToLang(t.canton);
    const prenom = t.first_name ?? "Thérapeute";
    const sujetsDefaut: Record<string, string> = {
      fr: `${prenom}, votre profil Holiswiss vous attend !`, de: `${prenom}, Ihr HoliSwiss-Profil wartet!`,
      it: `${prenom}, il suo profilo HoliSwiss l'aspetta!`, en: `${prenom}, your HoliSwiss profile is waiting!`,
    };
    let corps = `Bonjour ${prenom}, complétez votre profil sur holiswiss.ch`;
    let sujet = sujetsDefaut[lang];

    if (template && template[`subject_${lang}`] && template[`text_${lang}`]) {
      sujet = String(template[`subject_${lang}`]).replace(/\{\{prenom\}\}/g, prenom);
      corps = String(template[`text_${lang}`]).replace(/\{\{prenom\}\}/g, prenom);
    } else if (MISTRAL_API_KEY) {
      const langName = lang === "fr" ? "français" : lang === "de" ? "allemand" : lang === "it" ? "italien" : "anglais";
      corps = await mistral(`Email chaleureux 150 mots en ${langName} pour ${prenom}, thérapeute HoliSwiss. Corps uniquement, utilise {{prenom}} comme placeholder.`);
      if (lang === "fr" && !cachedFr) cachedFr = { sujet: sujetsDefaut.fr, corps };
      corps = corps.replace(/\{\{prenom\}\}/g, prenom);
    }
    emailsGeneres.push({ email: t.email, sujet, corps, langue: lang });
  }

  if (!template && cachedFr) {
    await db.from("email_templates").insert({
      slug: "relance-profil-incomplet", category: "relance", is_active: true,
      subject_fr: cachedFr.sujet, text_fr: cachedFr.corps,
    });
  }

  await logSuccess(agent.id as string, agent.slug as string, { emailsGeneres }, startedAt, `✅ ${emailsGeneres.length} email(s) préparés${template ? " (depuis template en cache)" : ""}`);
  return { emailsGeneres };
}

// ─── Agent Stratégie Vidéo (routine, hors pipeline)
async function runVideo(agent: Record<string, unknown>, startedAt: Date) {
  const { data: articles } = await db.from("articles").select("title_fr").eq("status", "published");
  const titres = (articles ?? []).map((a: { title_fr: string }) => a.title_fr).join(", ") || "aucun";
  const prompt = `Agent Stratégie Vidéo Holiswiss.ch. Articles publiés : ${titres}
Plan 20 vidéos : 8FR + 8DE + 2IT + 2EN.
JSON : {"videos":[{"titre":"...","langue":"fr","plateforme":"YouTube","duree":"10min","points":["...","...","..."]},...],"priorite_absolue":{"titre":"...","raison":"..."}}`;
  const raw = await mistral(prompt);
  const plan = parseJsonOrThrow(raw);
  await logSuccess(agent.id as string, agent.slug as string, plan, startedAt, `✅ Plan 20 vidéos généré`);
  return plan;
}

// ─── Agent Modérateur — DÉSARMÉ : ne modifie plus therapists.status directement.
// Propose une décision et l'insère dans moderation_queue pour revue (par agent-qa
// dans le pipeline, ou par un humain via l'interface admin), jamais d'application automatique.
async function runModerateur(agent: Record<string, unknown>, startedAt: Date) {
  const { data: pending } = await db.from("therapists")
    .select("id,first_name,last_name,specialties,description,canton").eq("status", "pending").limit(5);
  if (!pending?.length) {
    await logSuccess(agent.id as string, agent.slug as string, { message: "Aucun thérapeute en attente" }, startedAt, "0 profils à modérer");
    return { message: "Aucun profil en attente" };
  }
  const decisions = [];
  for (const t of pending) {
    const prompt = `Tu es l'agent modérateur de Holiswiss.ch.
Profil thérapeute :
- Nom : ${t.first_name} ${t.last_name}
- Canton : ${t.canton}
- Description : ${t.description ?? "non renseignée"}

Analyse et réponds en JSON : {"decision":"approve"|"reject"|"review","score":0-100,"raison":"...","suggestions":["..."]}`;
    let decision: { decision: string; score: number; raison: string; suggestions: string[] } = {
      decision: "review", score: 50, raison: "Profil incomplet", suggestions: ["Ajouter une description"],
    };
    try {
      const raw = await mistral(prompt);
      decision = parseJsonOrThrow(raw) as typeof decision;
    } catch (_) { /* garde la décision par défaut "review" */ }

    decisions.push({ therapist_id: t.id, nom: `${t.first_name} ${t.last_name}`, ...decision });

    await db.from("moderation_queue").insert({
      type: "profile_update",
      status: "pending",
      priority: decision.score >= 70 ? "normal" : "high",
      reference_table: "therapists",
      reference_id: t.id,
      snapshot: { ...t, decision_proposee: decision },
      admin_notes: decision.raison,
    });
  }
  const msg = `✅ ${decisions.length} profil(s) analysés et mis en file de modération (aucune action automatique appliquée) : ${decisions.filter((d) => d.decision === "approve").length} proposition(s) d'approbation, ${decisions.filter((d) => d.decision === "reject").length} de rejet`;
  await logSuccess(agent.id as string, agent.slug as string, { decisions }, startedAt, msg);
  return { decisions, message: msg };
}

// runMarketing / runGrowth : dépréciés (redondants avec agent-recrutement, hors des
// 10 rôles de délégation) — retirés du ROUTES ci-dessous, code non conservé (jamais
// exécutés en pipeline ni en manuel ; supprimer entièrement s'ils ne sont référencés
// par aucun cron externe).

// ═══════════════════════════════════════════════════════════════
//  PRODUCTEURS DU PIPELINE DE DÉLÉGATION — un rôle unique par fonction
// ═══════════════════════════════════════════════════════════════
const KNOWN_PRODUCER_ROLES = ["seo_geo", "copywriting", "ux_ui", "billing", "db_supabase", "security_rls", "email"];

const ROLE_SLUG: Record<string, string> = {
  seo_geo: "seo-geo",
  copywriting: "agent-articles-geo",
  ux_ui: "agent-ux-ui",
  billing: "agent-billing",
  db_supabase: "agent-db-supabase",
  security_rls: "agent-securite",
  email: "agent-email",
  qa: "agent-qa",
  translator: "agent-translator",
  synthesizer: "agent-synthesizer",
  orchestrator: "agent-coordinateur",
};

async function produceCopywriting(taskText: string, opts: { variation?: number; feedback?: string | null } = {}): Promise<unknown> {
  const consigne = opts.feedback ? `\nRetours de la vérification précédente à corriger : ${opts.feedback}` : "";
  const variation = opts.variation ? `\nVariation ${opts.variation} : propose un angle différent des autres candidats.` : "";
  const prompt = `Tu es l'agent Copywriting de Holiswiss.ch (annuaire de thérapeutes holistiques en Suisse).
Tâche : "${taskText}"${consigne}${variation}
Réponds en JSON : {"titre":"...","contenu":"markdown 300-600 mots","langue_principale":"fr","cta":"..."}`;
  const raw = await mistral(prompt);
  return parseJsonOrThrow(raw);
}

function scoreLetterToInt(letter: string): number {
  return ({ A: 90, B: 75, C: 55, D: 30 } as Record<string, number>)[letter] ?? 50;
}

async function produceSeoGeo(taskText: string, opts: { feedback?: string | null } = {}): Promise<unknown> {
  const consigne = opts.feedback ? `\nRetours précédents à intégrer : ${opts.feedback}` : "";
  const { data: articles } = await db.from("articles").select("id,slug,title_fr").eq("status", "published").limit(10);
  const prompt = `Tu es l'agent SEO/GEO de Holiswiss.ch.
Tâche : "${taskText}"${consigne}
Articles publiés (échantillon) : ${(articles ?? []).map((a: { title_fr: string }) => a.title_fr).join(", ") || "aucun"}
Réponds en JSON : {"score_geo":"A|B|C|D","recommandations":["...","..."],"requetes_cibles":["...","..."],"pret_pour_publication":true|false}`;
  const raw = await mistral(prompt);
  const rapport = parseJsonOrThrow(raw);
  await db.from("seo_geo_reports").insert({
    agent_version: "delegation-v1", status: "pending_validation",
    geo_score: scoreLetterToInt(String(rapport.score_geo ?? "C")),
    geo_recommendations: rapport.recommandations ?? [],
    content_suggestions: rapport.requetes_cibles ?? [],
    pages_analyzed: (articles ?? []).length,
  });
  return rapport;
}

async function produceUxUi(taskText: string): Promise<unknown> {
  const prompt = `Tu es l'agent UX/UI de Holiswiss.ch.
Tâche : "${taskText}"
Réponds en JSON : {"constats":["...","..."],"recommandations":["...","..."],"priorite":"haute|moyenne|basse"}`;
  const raw = await mistral(prompt);
  return parseJsonOrThrow(raw);
}

async function produceBilling(taskText: string): Promise<unknown> {
  const [{ count: subsCount }, { count: invCount }] = await Promise.all([
    db.from("subscriptions").select("*", { count: "exact", head: true }),
    db.from("invoices").select("*", { count: "exact", head: true }),
  ]);
  return {
    tache: taskText,
    abonnements_en_base: subsCount ?? 0,
    factures_en_base: invCount ?? 0,
    message: (subsCount ?? 0) === 0 && (invCount ?? 0) === 0
      ? "Aucune donnée de facturation en base pour l'instant — rien à auditer, structure prête pour Stripe."
      : `${subsCount} abonnement(s), ${invCount} facture(s) en base.`,
  };
}

async function produceDbSupabase(taskText: string): Promise<unknown> {
  const { data: therapeutes } = await db.from("therapists").select("email");
  const emails = (therapeutes ?? []).map((t: { email: string }) => t.email);
  const doublonsEmail = [...new Set(emails.filter((e, i) => emails.indexOf(e) !== i))];
  const { data: articles } = await db.from("articles").select("slug");
  const slugs = (articles ?? []).map((a: { slug: string }) => a.slug);
  const slugsDupliques = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
  return {
    tache: taskText,
    doublons_email_therapeutes: doublonsEmail,
    slugs_articles_dupliques: slugsDupliques,
    message: doublonsEmail.length || slugsDupliques.length
      ? "Anomalies de données détectées."
      : "Aucune anomalie de données détectée (emails thérapeutes, slugs articles).",
  };
}

async function produceSecurityRls(taskText: string): Promise<unknown> {
  const checks: Array<{ table: string; rows: number }> = [];
  for (const table of SECURITY_CRITICAL_TABLES) {
    const { count } = await db.from(table as "therapists").select("*", { count: "exact", head: true });
    checks.push({ table, rows: count ?? 0 });
  }
  return {
    tache: taskText,
    tables_verifiees: checks,
    message: `✅ ${checks.length} tables vérifiées, ${checks.reduce((s, c) => s + c.rows, 0)} enregistrements comptés.`,
  };
}

async function produceEmail(taskText: string): Promise<unknown> {
  const prompt = `Tu es l'agent Email de Holiswiss.ch.
Tâche : "${taskText}"
Réponds en JSON : {"sujet_fr":"...","corps_fr":"150 mots max","sujet_de":"...","corps_de":"..."}`;
  const raw = await mistral(prompt);
  return parseJsonOrThrow(raw);
}

const PRODUCER_FUNCS: Record<string, (taskText: string, opts?: { variation?: number; feedback?: string | null }) => Promise<unknown>> = {
  seo_geo: produceSeoGeo,
  copywriting: produceCopywriting,
  ux_ui: produceUxUi,
  billing: produceBilling,
  db_supabase: produceDbSupabase,
  security_rls: produceSecurityRls,
  email: produceEmail,
};

// ═══════════════════════════════════════════════════════════════
//  VÉRIFICATEURS — QA (générique) + Translator (cohérence 4 langues)
//  Ne produisent jamais de contenu original, uniquement des verdicts.
// ═══════════════════════════════════════════════════════════════
interface Verdict { verdict: string; score: number; raisons: string[] }

async function verifyWithQa(taskText: string, producerOutput: unknown): Promise<Verdict> {
  const prompt = `Tu es l'agent QA de Holiswiss.ch — vérificateur indépendant, tu ne produis jamais de contenu toi-même.
Tâche d'origine : "${taskText}"
Sortie du producteur à vérifier : ${JSON.stringify(producerOutput).slice(0, 4000)}
Vérifie : pertinence par rapport à la tâche, cohérence, absence d'erreur factuelle évidente, qualité suffisante pour être exploitée.
Réponds en JSON : {"verdict":"approved|rejected|needs_revision","score":0-100,"raisons":["...","..."]}`;
  const raw = await mistral(prompt);
  const parsed = parseJsonOrThrow(raw);
  const verdict = ["approved", "rejected", "needs_revision"].includes(String(parsed.verdict)) ? String(parsed.verdict) : "needs_revision";
  return { verdict, score: Number(parsed.score ?? 50), raisons: Array.isArray(parsed.raisons) ? parsed.raisons.map(String) : [] };
}

async function verifyWithTranslator(taskText: string, producerOutput: unknown): Promise<Verdict> {
  const prompt = `Tu es l'agent Translator de Holiswiss.ch — tu vérifies UNIQUEMENT la cohérence terminologique inter-langues (FR/DE/IT/EN), jamais le fond.
Tâche d'origine : "${taskText}"
Sortie à vérifier : ${JSON.stringify(producerOutput).slice(0, 4000)}
Réponds en JSON : {"verdict":"approved|rejected|needs_revision","score":0-100,"raisons":["...","..."]}`;
  const raw = await mistral(prompt);
  const parsed = parseJsonOrThrow(raw);
  const verdict = ["approved", "rejected", "needs_revision"].includes(String(parsed.verdict)) ? String(parsed.verdict) : "needs_revision";
  return { verdict, score: Number(parsed.score ?? 50), raisons: Array.isArray(parsed.raisons) ? parsed.raisons.map(String) : [] };
}

// ─── Manuel : auto-test générique pour les nouveaux rôles (bouton "Lancer" du roster)
async function runGenericRoleManual(agent: Record<string, unknown>, startedAt: Date, role: string, defaultTask: string) {
  const output = await PRODUCER_FUNCS[role](defaultTask);
  await logSuccess(agent.id as string, agent.slug as string, output, startedAt, `✅ ${role} exécuté (auto-test manuel)`);
  return output;
}
async function runQaManual(agent: Record<string, unknown>, startedAt: Date) {
  const output = { message: "L'agent QA est un vérificateur — il s'active uniquement au sein du pipeline de délégation, sur la sortie d'un autre agent." };
  await logSuccess(agent.id as string, agent.slug as string, output, startedAt, "QA : rôle vérificateur, rien à auto-tester isolément");
  return output;
}
async function runTranslatorManual(agent: Record<string, unknown>, startedAt: Date) {
  const output = { message: "L'agent Translator vérifie la cohérence 4 langues d'une sortie copywriting existante — pas d'auto-test isolé." };
  await logSuccess(agent.id as string, agent.slug as string, output, startedAt, "Translator : rôle vérificateur, rien à auto-tester isolément");
  return output;
}
async function runSynthesizerManual(agent: Record<string, unknown>, startedAt: Date) {
  const output = { message: "L'agent Synthesizer résume le pipeline d'une délégation existante — pas d'auto-test isolé." };
  await logSuccess(agent.id as string, agent.slug as string, output, startedAt, "Synthesizer : s'active en fin de pipeline uniquement");
  return output;
}

// ═══════════════════════════════════════════════════════════════
//  ROUTEUR MANUEL (mode { agent_slug }, inchangé pour l'admin)
// ═══════════════════════════════════════════════════════════════
const ROUTES: Record<string, (agent: Record<string, unknown>, startedAt: Date) => Promise<unknown>> = {
  "agent-coordinateur": runCoordinateurIA,
  "agent-recrutement": runRecrutementIA,
  "agent-securite": runSecurite,
  "agent-articles-geo": runArticlesGeo,
  "agent-social": runSocial,
  "agent-faq": runFaqSeo,
  "agent-seo-audit": runSeoAudit,
  "seo-geo": runSeoGeoManual,
  "agent-email": runEmail,
  "agent-video": runVideo,
  "moderateur": runModerateur,
  "agent-ux-ui": (agent, startedAt) => runGenericRoleManual(agent, startedAt, "ux_ui", "Audit UX/UI général du site Holiswiss"),
  "agent-billing": (agent, startedAt) => runGenericRoleManual(agent, startedAt, "billing", "Audit facturation général"),
  "agent-db-supabase": (agent, startedAt) => runGenericRoleManual(agent, startedAt, "db_supabase", "Contrôle qualité de données général"),
  "agent-qa": runQaManual,
  "agent-translator": runTranslatorManual,
  "agent-synthesizer": runSynthesizerManual,
};

// ═══════════════════════════════════════════════════════════════
//  PIPELINE DE DÉLÉGATION — comprendre / router / déléguer / vérifier / synthétiser
// ═══════════════════════════════════════════════════════════════
const MAX_LOOP_ITERATIONS = 3;
const TOURNAMENT_CANDIDATES = 3;

const CLASSIFICATION_DEFAULT_ROLES: Record<string, string[]> = {
  content: ["copywriting"],
  data: ["db_supabase"],
  security: ["security_rls"],
  design: ["ux_ui"],
  // "quality" : db_supabase produit l'audit, agent-qa le vérifie ensuite — QA reste
  // strictement un vérificateur, jamais un producteur, pour préserver l'invariant
  // "le même agent ne produit et ne valide jamais sa propre sortie".
  quality: ["db_supabase"],
  billing: ["billing"],
};

interface Understanding { classification: string; domaines: string[]; complexite: string; multilingue: boolean; raison: string }
interface Routing { pattern: string; agents: string[] }

async function classifyRequest(rawInput: string): Promise<Understanding> {
  const prompt = `Tu es l'orchestrateur de The Summer Delegation (Holiswiss.ch, annuaire de thérapeutes holistiques en Suisse).
Analyse la demande admin suivante et classe-la.

Demande : "${rawInput}"

Rôles producteurs possibles : seo_geo, copywriting, ux_ui, billing, db_supabase, security_rls, email.
Règles de routage :
- contenu (rédaction, articles, posts) -> copywriting ; audit/optimisation SEO/GEO -> seo_geo
- données/schéma Supabase -> db_supabase
- sécurité/RLS -> security_rls
- design/UX -> ux_ui
- qualité/modération -> db_supabase (l'agent QA vérifiera ensuite, il ne produit jamais lui-même)
- paiement/facture/abonnement -> billing
- email thérapeutes -> email

Réponds UNIQUEMENT en JSON :
{"classification":"content|data|security|design|quality|billing|multi|uncertain|subjective|open_ended",
 "domaines":["role1","role2"],
 "complexite":"simple|multi|incertaine|subjective|ouverte",
 "multilingue": true|false,
 "raison":"1 phrase expliquant le choix"}`;
  const raw = await mistral(prompt);
  const parsed = parseJsonOrThrow(raw);
  const domaines = Array.isArray(parsed.domaines)
    ? (parsed.domaines as unknown[]).filter((d): d is string => KNOWN_PRODUCER_ROLES.includes(String(d)))
    : [];
  return {
    classification: String(parsed.classification ?? "uncertain"),
    domaines,
    complexite: String(parsed.complexite ?? "incertaine"),
    multilingue: Boolean(parsed.multilingue),
    raison: String(parsed.raison ?? ""),
  };
}

function decideRouting(u: Understanding): Routing {
  if (u.complexite === "incertaine") return { pattern: "classify-and-act", agents: [] };
  if (u.complexite === "subjective") return { pattern: "tournament", agents: [u.domaines[0] ?? "copywriting"] };
  if (u.complexite === "ouverte") return { pattern: "loop-until-done", agents: [u.domaines[0] ?? "seo_geo"] };
  if (u.complexite === "multi" || u.domaines.length > 1) {
    const agents = u.domaines.length ? u.domaines : (CLASSIFICATION_DEFAULT_ROLES[u.classification] ?? ["copywriting"]);
    return { pattern: "fan-out-and-synthesize", agents };
  }
  const agents = u.domaines.length ? [u.domaines[0]] : (CLASSIFICATION_DEFAULT_ROLES[u.classification] ?? ["copywriting"]);
  return { pattern: "single-agent", agents };
}

async function clarifyRole(rawInput: string, understanding: Understanding): Promise<{ role: string; raison: string }> {
  const prompt = `La demande admin suivante était ambiguë : "${rawInput}" (raison : ${understanding.raison}).
Choisis UN SEUL rôle parmi : seo_geo, copywriting, ux_ui, billing, db_supabase, security_rls, email.
Réponds en JSON {"role":"...","raison":"..."}`;
  const raw = await mistral(prompt);
  const parsed = parseJsonOrThrow(raw);
  const role = KNOWN_PRODUCER_ROLES.includes(String(parsed.role)) ? String(parsed.role) : "copywriting";
  return { role, raison: String(parsed.raison ?? "") };
}

async function produceSynthesis(
  taskText: string, understanding: Understanding, routing: Routing,
  delegateResults: Array<{ stepId: string; role: string; output: unknown }>,
  verdictObj: Verdict, translatorVerdict: Verdict | null,
) {
  const resumeAgents = delegateResults.map((d) => ({ agent: d.role, resume: JSON.stringify(d.output).slice(0, 300), output_ref: d.stepId }));
  const prompt = `Tu es l'agent Synthesizer de Holiswiss.ch — tu ne produis jamais de contenu original, tu résumes.
Demande d'origine : "${taskText}"
Pattern utilisé : ${routing.pattern}
Agents utilisés : ${routing.agents.join(", ")}
Résultats : ${JSON.stringify(resumeAgents).slice(0, 3000)}
Verdict du vérificateur : ${JSON.stringify(verdictObj)}
Rédige une synthèse finale en 4-6 lignes en français, actionnable pour Gérald, et liste les points de vigilance restants s'il y en a.
Réponds en JSON : {"synthese_finale":"...","points_vigilance":["...","..."]}`;
  const raw = await mistral(prompt);
  const parsed = parseJsonOrThrow(raw);
  return {
    plan: understanding.raison,
    agents_utilises: routing.agents,
    resultats_agents: resumeAgents,
    resultat_verificateur: verdictObj,
    resultat_traducteur: translatorVerdict,
    synthese_finale: String(parsed.synthese_finale ?? ""),
    points_vigilance: Array.isArray(parsed.points_vigilance) ? (parsed.points_vigilance as unknown[]).map(String) : [],
  };
}

// ─── Helpers d'écriture delegation_steps + pont ai_agent_logs
async function bridgeLog(agentSlug: string | null, stepId: string, status: string, message: string, output: unknown) {
  if (!agentSlug) return;
  const agent = await getAgent(agentSlug);
  if (!agent) return;
  await db.from("ai_agent_logs").insert({
    agent_id: agent.id, agent_slug: agentSlug, status, level: "info",
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    output, message, triggered_by: "delegation", delegation_step_id: stepId,
  });
}

async function runStep<T>(
  requestId: string, phase: string, order: number, agentSlug: string | null,
  input: unknown, fn: () => Promise<T>, extra: Record<string, unknown> = {},
): Promise<{ stepId: string; output: T }> {
  const startedAt = new Date();
  const { data: inserted, error: insertErr } = await db.from("delegation_steps").insert({
    request_id: requestId, phase, step_order: order, agent_slug: agentSlug, status: "running",
    input, started_at: startedAt.toISOString(), ...extra,
  }).select().single();
  if (insertErr) throw new Error(`insertStep(${phase}): ${insertErr.message}`);
  const stepId = inserted.id as string;

  try {
    const output = await fn();
    await db.from("delegation_steps").update({
      status: "success", output, finished_at: new Date().toISOString(), duration_ms: Date.now() - startedAt.getTime(),
    }).eq("id", stepId);
    await bridgeLog(agentSlug, stepId, "success", `Étape ${phase} réussie`, output);
    return { stepId, output };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.from("delegation_steps").update({
      status: "error", output: { error: msg }, finished_at: new Date().toISOString(), duration_ms: Date.now() - startedAt.getTime(),
    }).eq("id", stepId);
    await bridgeLog(agentSlug, stepId, "error", `Étape ${phase} en erreur: ${msg}`, { error: msg });
    throw err;
  }
}

// Vérification : garde-fou CODE (en plus du trigger DB) — le vérificateur ne peut
// jamais être le producteur, ni un rôle non autorisé par can_verify_roles.
async function runVerifyStep(
  requestId: string, order: number, verifierSlug: string, producerStepId: string,
  producerOutput: unknown, taskText: string,
): Promise<{ stepId: string; verdictObj: Verdict }> {
  const [{ data: verifierAgent }, { data: producerStepRow }] = await Promise.all([
    db.from("ai_agents").select("unique_role,can_verify_roles").eq("slug", verifierSlug).single(),
    db.from("delegation_steps").select("agent_slug").eq("id", producerStepId).single(),
  ]);
  const producerSlug = producerStepRow?.agent_slug as string | undefined;
  if (producerSlug && producerSlug === verifierSlug) {
    throw new Error(`VIOLATION: ${verifierSlug} ne peut pas vérifier sa propre sortie (step ${producerStepId})`);
  }
  if (producerSlug) {
    const { data: producerAgent } = await db.from("ai_agents").select("unique_role").eq("slug", producerSlug).single();
    const producerRole = producerAgent?.unique_role as string | undefined;
    const allowed = (verifierAgent?.can_verify_roles ?? []) as string[];
    if (producerRole && !allowed.includes(producerRole)) {
      throw new Error(`VIOLATION: ${verifierSlug} n'est pas autorisé à vérifier le rôle ${producerRole}`);
    }
  }

  const verifyFn = verifierSlug === "agent-translator" ? verifyWithTranslator : verifyWithQa;
  const { stepId, output: verdictObj } = await runStep(
    requestId, "verify", order, verifierSlug, { producerStepId, taskText },
    () => verifyFn(taskText, producerOutput),
    { verifier_of_step: producerStepId },
  );

  await db.from("delegation_steps").update({
    verification_verdict: verdictObj.verdict, verification_notes: verdictObj.raisons.join(" | ") || null,
    status: verdictObj.verdict === "rejected" ? "rejected" : "success",
  }).eq("id", stepId);

  await db.from("moderation_queue").insert({
    type: "system", status: verdictObj.verdict, reference_table: "delegation_steps", reference_id: producerStepId,
    snapshot: { producerOutput, verdictObj }, admin_notes: verdictObj.raisons.join(" | ") || null,
  });

  return { stepId, verdictObj };
}

async function synthesizeAndFinish(
  requestId: string, order: number, rawInput: string, understanding: Understanding, routing: Routing,
  delegateResults: Array<{ stepId: string; role: string; output: unknown }>,
  verdictObj: Verdict, verifierSlug: string, pipelineStartedAt: Date, translatorVerdict: Verdict | null = null,
) {
  await db.from("delegation_requests").update({ status: "synthesizing" }).eq("id", requestId);
  const { output: synthesis } = await runStep(
    requestId, "synthesize", order, "agent-synthesizer", { delegateResults, verdictObj },
    () => produceSynthesis(rawInput, understanding, routing, delegateResults, verdictObj, translatorVerdict),
  );
  await db.from("delegation_requests").update({
    status: "done", verifier_slug: verifierSlug, synthesis,
    finished_at: new Date().toISOString(), duration_ms: Date.now() - pipelineStartedAt.getTime(),
  }).eq("id", requestId);
}

async function runDelegationPipeline(requestId: string) {
  const { data: request } = await db.from("delegation_requests").select("*").eq("id", requestId).single();
  if (!request) throw new Error("delegation_request introuvable");
  const pipelineStartedAt = new Date();
  await db.from("delegation_requests").update({ status: "classifying", started_at: pipelineStartedAt.toISOString() }).eq("id", requestId);

  let order = 1;
  // Phase 1 — comprendre
  const { output: understanding } = await runStep(
    requestId, "understand", order++, "agent-coordinateur", { raw_input: request.raw_input },
    () => classifyRequest(request.raw_input),
  );
  await db.from("delegation_requests").update({ classification: understanding.classification, status: "routing" }).eq("id", requestId);

  // Phase 2 — router (déterministe, pas de LLM, pour rester prévisible)
  const { output: routing } = await runStep(
    requestId, "route", order++, "agent-coordinateur", { understanding },
    () => Promise.resolve(decideRouting(understanding)),
  );
  await db.from("delegation_requests").update({
    pattern: routing.pattern, agents_used: routing.agents, status: "executing",
    plan: { domaines: understanding.domaines, agents_prevus: routing.agents, raison_pattern: understanding.raison },
  }).eq("id", requestId);

  let finalRouting: Routing = routing;
  if (routing.pattern === "classify-and-act") {
    const { output: clarified } = await runStep(
      requestId, "delegate", order++, "agent-coordinateur", { understanding },
      () => clarifyRole(request.raw_input, understanding),
    );
    finalRouting = { pattern: "single-agent", agents: [clarified.role] };
    await db.from("delegation_requests").update({
      pattern: finalRouting.pattern, agents_used: finalRouting.agents,
      plan: { domaines: understanding.domaines, agents_prevus: finalRouting.agents, raison_pattern: clarified.raison },
    }).eq("id", requestId);
  }

  let delegateResults: Array<{ stepId: string; role: string; output: unknown }> = [];

  if (finalRouting.pattern === "loop-until-done") {
    const role = finalRouting.agents[0] ?? "seo_geo";
    const slug = ROLE_SLUG[role];
    let feedback: string | null = null;
    let verdictObj: Verdict = { verdict: "needs_revision", score: 0, raisons: [] };
    let lastStepId = "";
    for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
      const { stepId, output } = await runStep(
        requestId, "delegate", order++, slug, { task: request.raw_input, iteration: i + 1, feedback },
        () => PRODUCER_FUNCS[role](request.raw_input, { feedback }),
      );
      lastStepId = stepId;
      delegateResults = [{ stepId, role, output }];
      await db.from("delegation_requests").update({ status: "verifying" }).eq("id", requestId);
      const verify = await runVerifyStep(requestId, order++, "agent-qa", stepId, output, request.raw_input);
      verdictObj = verify.verdictObj;
      feedback = verdictObj.raisons.join(" | ") || null;
      if (verdictObj.verdict === "approved") break;
    }
    if (verdictObj.verdict !== "approved") {
      await db.from("delegation_requests").update({
        status: "blocked",
        open_concerns: [{ message: `loop-until-done : pas d'approbation après ${MAX_LOOP_ITERATIONS} itérations`, dernier_retour: feedback, step_id: lastStepId }],
      }).eq("id", requestId);
      return;
    }
    await synthesizeAndFinish(requestId, order++, request.raw_input, understanding, finalRouting, delegateResults, verdictObj, "agent-qa", pipelineStartedAt);
    return;
  }

  if (finalRouting.pattern === "single-agent") {
    const role = finalRouting.agents[0] ?? "copywriting";
    const slug = ROLE_SLUG[role];
    const { stepId, output } = await runStep(
      requestId, "delegate", order++, slug, { task: request.raw_input },
      () => PRODUCER_FUNCS[role](request.raw_input),
    );
    delegateResults = [{ stepId, role, output }];
  } else if (finalRouting.pattern === "fan-out-and-synthesize") {
    const roles = finalRouting.agents;
    const baseOrder = order;
    const results = await Promise.all(roles.map((role, i) =>
      runStep(
        requestId, "delegate", baseOrder + i, ROLE_SLUG[role], { task: request.raw_input },
        () => PRODUCER_FUNCS[role](request.raw_input),
      )
    ));
    order += roles.length;
    delegateResults = results.map((r, i) => ({ stepId: r.stepId, role: roles[i], output: r.output }));
  } else if (finalRouting.pattern === "tournament") {
    const role = finalRouting.agents[0] ?? "copywriting";
    const slug = ROLE_SLUG[role];
    for (let i = 0; i < TOURNAMENT_CANDIDATES; i++) {
      const { stepId, output } = await runStep(
        requestId, "delegate", order++, slug, { task: request.raw_input, variation: i + 1 },
        () => PRODUCER_FUNCS[role](request.raw_input, { variation: i + 1 }),
      );
      delegateResults.push({ stepId, role, output });
    }
  }

  // Phase 4 — vérifier (le vérificateur QA reçoit toujours un producteur différent de lui)
  await db.from("delegation_requests").update({ status: "verifying" }).eq("id", requestId);
  const primary = delegateResults[delegateResults.length - 1];
  const outputPourVerif = finalRouting.pattern === "tournament" ? delegateResults.map((d) => d.output) : primary.output;
  const { verdictObj } = await runVerifyStep(requestId, order++, "agent-qa", primary.stepId, outputPourVerif, request.raw_input);

  let translatorVerdict: Verdict | null = null;
  if (primary.role === "copywriting" && understanding.multilingue) {
    const r = await runVerifyStep(requestId, order++, "agent-translator", primary.stepId, primary.output, request.raw_input);
    translatorVerdict = r.verdictObj;
  }

  if (verdictObj.verdict === "rejected") {
    await db.from("delegation_requests").update({
      status: "blocked", verifier_slug: "agent-qa",
      open_concerns: [{ message: "Vérification QA rejetée", raisons: verdictObj.raisons }],
    }).eq("id", requestId);
    return;
  }

  await synthesizeAndFinish(requestId, order++, request.raw_input, understanding, finalRouting, delegateResults, verdictObj, "agent-qa", pipelineStartedAt, translatorVerdict);
}

// ═══════════════════════════════════════════════════════════════
//  HANDLER HTTP
// ═══════════════════════════════════════════════════════════════
// Garde d'accès : soit un secret partagé (appels machine/cron), soit un JWT d'administrateur.
async function isAuthorized(req: Request): Promise<boolean> {
  const sharedSecret = Deno.env.get("RUN_AGENT_SECRET") ?? "";
  const provided = req.headers.get("x-agent-secret") ?? "";
  if (sharedSecret && provided) {
    const a = new TextEncoder().encode(sharedSecret);
    const b = new TextEncoder().encode(provided);
    if (a.length === b.length) {
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
      if (diff === 0) return true;
    }
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7).trim();
  if (!token) return false;

  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return false;

  const { data: roles } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  return Boolean(roles);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (!(await isAuthorized(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  const startedAt = new Date();


  try {
    const body = await req.json();

    // MODE PIPELINE DE DÉLÉGATION
    if (body.delegation_request_id) {
      const requestId = body.delegation_request_id as string;
      try {
        await runDelegationPipeline(requestId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[run-agent][pipeline] Erreur :", msg);
        await db.from("delegation_requests").update({
          status: "failed", error_message: msg, finished_at: new Date().toISOString(),
        }).eq("id", requestId);
        return new Response(JSON.stringify({ error: msg }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      const { data: finalRequest } = await db.from("delegation_requests").select("*").eq("id", requestId).single();
      return new Response(JSON.stringify({ success: true, request: finalRequest }), {
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    // MODE LANCEMENT MANUEL SIMPLE (inchangé)
    const { agent_slug } = body;
    if (!agent_slug) return new Response(JSON.stringify({ error: "agent_slug ou delegation_request_id requis" }), { status: 400, headers: CORS_HEADERS });

    const agent = await getAgent(agent_slug);
    if (!agent) return new Response(JSON.stringify({ error: `Agent "${agent_slug}" introuvable` }), { status: 404, headers: CORS_HEADERS });

    await db.from("ai_agents").update({ status: "running" }).eq("id", agent.id);

    const handler = ROUTES[agent_slug];
    if (!handler) {
      await logError(agent.id, agent.slug, `Aucun handler pour "${agent_slug}"`, startedAt);
      return new Response(JSON.stringify({ error: `Agent "${agent_slug}" non implémenté` }), { status: 501, headers: CORS_HEADERS });
    }

    const result = await handler(agent, startedAt);
    return new Response(JSON.stringify({ success: true, agent: agent_slug, result }), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[run-agent] Erreur :`, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
