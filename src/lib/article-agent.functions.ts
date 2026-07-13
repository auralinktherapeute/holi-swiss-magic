import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import { normalizeImportArticle } from "@/lib/article-import-normalizer";
import { computeSeo, computeGeo } from "@/lib/article-scoring";

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Settings ─────────────────────────────────────────────────────────────────

const AGENT_KEY = "seo_article_agent_enabled";

export const getArticleAgentEnabled = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("value")
      .eq("key", AGENT_KEY)
      .maybeSingle();
    return { enabled: data?.value === true || data?.value === "true" };
  });

export const setArticleAgentEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ enabled: z.boolean() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("app_settings")
      .upsert({ key: AGENT_KEY, value: data.enabled, updated_at: new Date().toISOString() });
    if (error) throw new Error("Impossible de modifier le réglage.");
    return { ok: true, enabled: data.enabled };
  });

// ── Generation ───────────────────────────────────────────────────────────────

const GenerateInput = z.object({
  topic: z.string().min(3).max(200),
  category: z.string().min(2).max(50).default("bien-etre"),
});

type GeneratedArticle = {
  title_fr: string;
  excerpt_fr: string;
  body_fr: string;
  meta_title_fr: string;
  meta_description_fr: string;
  slug: string;
};

export const generateArticleViaAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(GenerateInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Check agent enabled
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: setting } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("value")
      .eq("key", AGENT_KEY)
      .maybeSingle();
    const enabled = setting?.value === true || setting?.value === "true";
    if (!enabled) {
      throw new Error("L'agent SEO/GEO est désactivé. Activez-le avant de générer.");
    }

    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");

    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { generateText, Output } = await import("ai");

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: {
        "Lovable-API-Key": lovableKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    const schema = z.object({
      title_fr: z.string(),
      excerpt_fr: z.string(),
      body_fr: z.string(),
      meta_title_fr: z.string(),
      meta_description_fr: z.string(),
      slug: z.string(),
    });

    const system = `Vous êtes rédacteur SEO/GEO pour HoliSwiss, annuaire suisse de thérapeutes en approches complémentaires.
Règles strictes (LPMéd) : interdit d'utiliser "soin", "guérison", "traitement", "diagnostic", "prescription".
Privilégier : "accompagnement", "approche", "pratique", "bien-être", "équilibre".
Cible géographique : Suisse romande (Genève, Lausanne, Neuchâtel, Fribourg, Valais).
Ton : informatif, bienveillant, factuel.`;

    const prompt = `Génère un article complet en français sur : "${data.topic}".
Catégorie : ${data.category}.
Body : markdown, 600-1000 mots, avec sous-titres ## et au moins 4 sections.
Title : 50-65 caractères, accrocheur, contient le mot-clé principal.
Meta description : 140-160 caractères.
Excerpt : 1-2 phrases, 150-250 caractères.
Slug : kebab-case sans accents, suffixé par "-suisse" si pertinent.`;

    let generated: GeneratedArticle;
    try {
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        system,
        prompt,
        experimental_output: Output.object({ schema }),
      });
      generated = (result as any).experimental_output as GeneratedArticle;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) throw new Error("Limite de requêtes atteinte. Réessayez plus tard.");
      if (msg.includes("402")) throw new Error("Crédits IA épuisés. Rechargez votre workspace.");
      throw new Error(`Génération échouée : ${msg}`);
    }

    // Slug doublon check
    let finalSlug = toSlug(generated.slug || generated.title_fr);
    const { data: existing } = await (supabaseAdmin as any)
      .from("articles")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();
    if (existing) {
      finalSlug = `${finalSlug}-${Date.now().toString(36)}`;
    }

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("articles")
      .insert({
        slug: finalSlug,
        status: "pending_validation",
        lang: "fr",
        category: data.category,
        title_fr: generated.title_fr,
        excerpt_fr: generated.excerpt_fr,
        body_fr: generated.body_fr,
        meta_title_fr: generated.meta_title_fr,
        meta_description_fr: generated.meta_description_fr,
        author_id: context.userId,
      })
      .select("id, slug, title_fr")
      .single();

    if (error) throw new Error(`Insertion échouée : ${error.message}`);

    // Auto-translation FR → DE/IT/EN (best-effort, ne bloque pas la création)
    try {
      await translateArticleRow(inserted.id);
    } catch (e) {
      console.warn("[article-agent] auto-translation failed:", (e as Error).message);
    }

    return { article: inserted };
  });

// ── Optimiseur SEO/GEO à la demande ──────────────────────────────────────────
// Même logique que l'agent optimiseur quotidien (6h30) : hill-climbing
// monotone contre la VRAIE formule (article-scoring.ts) — le score affiché
// dans l'admin ne peut jamais baisser. Écrit directement en base (donc peut
// aussi remplir image_alt_text, inaccessible via le webhook) → 100/100 possible.

const OPTIMIZE_FIELDS = ["title_fr", "meta_title_fr", "meta_description_fr", "excerpt_fr", "body_fr"] as const;

export const optimizeArticleSeoGeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await (supabaseAdmin as any)
      .from("articles")
      .select("id,slug,category,title_fr,meta_title_fr,meta_description_fr,excerpt_fr,body_fr,cover_image_url,image_alt_text,status")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Article introuvable.");

    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");

    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { generateText, Output } = await import("ai");
    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const schema = z.object({
      title_fr: z.string(),
      meta_title_fr: z.string(),
      meta_description_fr: z.string(),
      excerpt_fr: z.string(),
      body_fr: z.string(),
      image_alt_text: z.string().optional(),
    });

    const system = `Vous êtes l'optimiseur SEO/GEO de HoliSwiss (annuaire suisse de thérapeutes holistiques).
Vous réécrivez des articles en FRANÇAIS pour satisfaire des critères MESURÉS PAR UN PROGRAMME, au caractère près.
Règles strictes (LPMéd) : interdit d'utiliser "soin", "guérison", "traitement", "diagnostic", "prescription".
Privilégier : "accompagnement", "approche", "pratique", "bien-être", "équilibre".
Conserver le sujet, la structure Markdown et un texte naturel et agréable à lire.`;

    let best = { ...row };
    let bestSeo = computeSeo(best);
    let bestGeo = computeGeo(best);
    const seoBefore = bestSeo.score;
    const geoBefore = bestGeo.score;
    const MAX_ITER = 3;

    for (let iter = 0; iter < MAX_ITER; iter++) {
      if (bestSeo.score >= 100 && bestGeo.score >= 100) break;

      const failing = bestSeo.checklist
        .filter((c) => !c.ok)
        .map((c) => `- ${c.label}${c.hint ? ` (${c.hint})` : ""}`)
        .join("\n");
      const geoNeeds = bestGeo.score < 100
        ? `- Villes suisses distinctes : ${bestGeo.cities.length}/4 min (Lausanne, Genève, Zurich, Bâle, Berne, Sion, Fribourg, Neuchâtel, Montreux, Vevey…)
- Cantons distincts : ${bestGeo.cantons.length}/3 min (Vaud, Valais, Genève, Fribourg, Berne, Jura, Neuchâtel, Tessin…)
- Mots-clés suisses : ${bestGeo.keywords.length}/3 min (« suisse », « romande », « romandie », « helvétique »)`
        : "- aucun";

      const prompt = `Améliore cet article pour corriger UNIQUEMENT les critères en échec, sans casser ceux qui passent.

ARTICLE ACTUEL (JSON) :
${JSON.stringify({
  title_fr: best.title_fr, meta_title_fr: best.meta_title_fr,
  meta_description_fr: best.meta_description_fr, excerpt_fr: best.excerpt_fr,
  body_fr: best.body_fr, category: best.category,
  image_alt_text: best.image_alt_text ?? null,
})}

CRITÈRES SEO EN ÉCHEC (score actuel ${bestSeo.score}/100) :
${failing || "- aucun"}

BESOINS GEO (score actuel ${bestGeo.score}/100) :
${geoNeeds}

CONTRAINTES TECHNIQUES PRÉCISES (mesurées au caractère près) :
1. title_fr : entre 50 et 60 caractères INCLUS (espaces compris). Compter avant de répondre.
2. title_fr doit contenir la chaîne exacte « ${row.category ?? ""} » (sans accents, insensible à la casse). Si l'orthographe française a des accents, utiliser la graphie sans accent (ex. « Kinesiologie »), c'est accepté.
3. meta_description_fr : entre 150 et 160 caractères INCLUS.
4. body_fr : Markdown, min 320 mots, au moins 2 titres « ## » et 1 titre « ### », au moins 1 lien interne [texte](/fr/therapeutes), phrases de 10 à 25 mots en moyenne.
5. body_fr doit mentionner au moins 4 villes suisses différentes, 3 cantons différents et les mots « suisse », « romande », « helvétique ».
6. excerpt_fr : 1–2 phrases d'accroche (max 300 caractères), mentionnant la Suisse.
7. image_alt_text : description factuelle de l'image de couverture en 8–15 mots (thème : ${row.category ?? "bien-être"}).
8. NE PAS produire de HTML. NE PAS changer de sujet.`;

      let candidate: z.infer<typeof schema>;
      try {
        const result = await generateText({
          model: provider("google/gemini-3-flash-preview"),
          system,
          prompt,
          experimental_output: Output.object({ schema }),
        });
        candidate = (result as any).experimental_output;
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.includes("429")) throw new Error("Limite de requêtes IA atteinte. Réessayez dans une minute.");
        if (msg.includes("402")) throw new Error("Crédits IA épuisés. Rechargez votre workspace Lovable.");
        break; // autre erreur IA : on garde la meilleure version
      }

      const next = { ...best };
      for (const f of OPTIMIZE_FIELDS) {
        const v = candidate[f];
        if (typeof v === "string" && v.trim()) next[f] = v.trim();
      }
      if (row.cover_image_url && candidate.image_alt_text?.trim()) {
        next.image_alt_text = candidate.image_alt_text.trim();
      }

      const nextSeo = computeSeo(next);
      const nextGeo = computeGeo(next);
      // Monotonie stricte : jamais de baisse sur AUCUN des deux axes
      if (
        nextSeo.score >= bestSeo.score &&
        nextGeo.score >= bestGeo.score &&
        nextSeo.score + nextGeo.score > bestSeo.score + bestGeo.score
      ) {
        best = next;
        bestSeo = nextSeo;
        bestGeo = nextGeo;
      }
    }

    const improved = bestSeo.score + bestGeo.score > seoBefore + geoBefore;
    if (improved) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const f of OPTIMIZE_FIELDS) patch[f] = best[f];
      if (best.image_alt_text) patch.image_alt_text = best.image_alt_text;
      const { error: upError } = await (supabaseAdmin as any)
        .from("articles")
        .update(patch)
        .eq("id", data.id);
      if (upError) throw new Error(`Enregistrement échoué : ${upError.message}`);
    }

    return {
      updated: improved,
      seoBefore, seoAfter: bestSeo.score,
      geoBefore, geoAfter: bestGeo.score,
      remaining: bestSeo.checklist.filter((c) => !c.ok).map((c) => c.label),
    };
  });

// ── Translation ──────────────────────────────────────────────────────────────

const TARGET_LANGS = [
  { code: "de", label: "allemand (Hochdeutsch standard suisse)" },
  { code: "it", label: "italien (italien de Suisse italienne)" },
  { code: "en", label: "anglais (international, ton britannique neutre)" },
] as const;

async function translateArticleRow(articleId: string): Promise<{ updated: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await (supabaseAdmin as any)
    .from("articles")
    .select("id,title_fr,excerpt_fr,body_fr,meta_title_fr,meta_description_fr,title_de,title_it,title_en,body_de,body_it,body_en")
    .eq("id", articleId)
    .maybeSingle();
  if (error || !row) throw new Error("Article introuvable.");
  if (!row.title_fr || !row.body_fr) throw new Error("Article FR incomplet : impossible de traduire.");

  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");

  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText } = await import("ai");

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const updated: string[] = [];
  const patch: Record<string, string> = {};

  for (const t of TARGET_LANGS) {
    // Skip si déjà traduit (titre ET body non vides)
    const existingTitle = ((row as any)[`title_${t.code}`] ?? "").toString().trim();
    const existingBody = ((row as any)[`body_${t.code}`] ?? "").toString().trim();
    if (existingTitle && existingBody) continue;

    const system = `Tu es traducteur SEO/GEO pour HoliSwiss. Traduis fidèlement vers le ${t.label}.
Règles : conserver le markdown (## titres, listes), garder les noms propres suisses (Genève, Lausanne…), respecter la LPMéd (pas de "guérison/traitement/diagnostic"). Adapte les expressions idiomatiques.
IMPORTANT : tu réponds UNIQUEMENT avec la traduction demandée, sans préambule, sans guillemets englobants, sans commentaire.`;

    const translateField = async (label: string, value: string, isMarkdown = false): Promise<string> => {
      const v = (value ?? "").toString();
      if (!v.trim()) return "";
      const prompt = isMarkdown
        ? `Traduis ce contenu Markdown (${label}) du français vers le ${t.label}. Garde la structure markdown intacte. Réponds uniquement avec la traduction.\n\n---\n${v}\n---`
        : `Traduis ce ${label} du français vers le ${t.label}. Réponds uniquement avec la traduction, sans guillemets.\n\nTEXTE : ${v}`;
      const result = await generateText({
        model: provider("google/gemini-3-flash-preview"),
        system,
        prompt,
      });
      return ((result as any).text as string).trim().replace(/^---\s*|\s*---$/g, "").trim();
    };

    try {
      const [title, excerpt, body, metaTitle, metaDesc] = await Promise.all([
        translateField("titre", row.title_fr),
        translateField("extrait", row.excerpt_fr ?? ""),
        translateField("corps de l'article", row.body_fr, true),
        translateField("meta title SEO", row.meta_title_fr ?? ""),
        translateField("meta description SEO", row.meta_description_fr ?? ""),
      ]);
      if (!title || !body) throw new Error("Champs vides retournés par l'IA");
      patch[`title_${t.code}`] = title;
      if (excerpt) patch[`excerpt_${t.code}`] = excerpt;
      patch[`body_${t.code}`] = body;
      if (metaTitle) patch[`meta_title_${t.code}`] = metaTitle;
      if (metaDesc) patch[`meta_description_${t.code}`] = metaDesc;
      updated.push(t.code);
    } catch (e) {
      console.warn(`[translate] ${t.code} failed:`, (e as Error).message);
    }
  }

  if (Object.keys(patch).length > 0) {
    const { error: upErr } = await (supabaseAdmin as any)
      .from("articles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", articleId);
    if (upErr) throw new Error(`Échec mise à jour : ${upErr.message}`);
  }

  return { updated };
}

export const translateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const res = await translateArticleRow(data.id);
    return res;
  });

export const translateAllMissingArticles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("articles")
      .select("id,title_fr,body_fr,body_de,body_it,body_en")
      .not("body_fr", "is", null);
    if (error) throw new Error("Impossible de lister les articles.");
    const toTranslate = (rows ?? []).filter((r: any) =>
      r.body_fr && (!r.body_de || !r.body_it || !r.body_en)
    );
    let success = 0, failed = 0;
    for (const r of toTranslate) {
      try { await translateArticleRow(r.id); success++; }
      catch { failed++; }
    }
    return { total: toTranslate.length, success, failed };
  });

// ── Import from external agent report ────────────────────────────────────────
// Ingestion admin (dashboard) : garantit que tout article produit par l'agent
// externe (rapport JSON/HTML/texte) apparaisse dans /admin/articles en
// `pending_validation`, indépendamment du webhook public.

const ImportInput = z.object({
  articles: z.array(z.record(z.unknown())).min(1).max(50),
});

export const importAgentArticlesAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ImportInput)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = data.articles.map((a) => ({
      ...normalizeImportArticle(a as Record<string, unknown>),
      author_id: context.userId,
      published_at: null,
      updated_at: new Date().toISOString(),
    }));

    const { data: inserted, error } = await (supabaseAdmin as any)
      .from("articles")
      .upsert(rows, { onConflict: "slug" })
      .select("id,slug,status,title_fr,category");

    if (error) throw new Error(`Import échoué : ${error.message}`);
    return { inserted_count: inserted?.length ?? 0, articles: inserted ?? [] };
  });