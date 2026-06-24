import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

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
    return { article: inserted };
  });