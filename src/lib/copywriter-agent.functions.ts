import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import { FIL_CATEGORIES, FIL_CATEGORY_SLUGS } from "@/data/fil-holiswiss";
import { searchUnsplashPhotos } from "@/lib/unsplash.functions";

/**
 * Agent Copywriter Actualités, pilotable depuis /admin/copywriter.
 *
 * Distinct de l'agent Marketing réseaux sociaux (fils de conversation séparés,
 * table dédiée) : celui-ci ne s'occupe QUE des publications du fil Holiswiss
 * (nouveautés, partenariats, portraits, conseils). Il ne publie jamais rien
 * directement — toute proposition entre dans `articles` au statut
 * `pending_validation`, donc visible et modifiable aussi bien ici que dans
 * l'administration Articles existante.
 */

const MODEL = "google/gemini-3-flash-preview";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

const GUARDRAILS = `
RÈGLES ABSOLUES — elles priment sur tout le reste :

1. Aucune allégation thérapeutique. Jamais « guérit », « soigne », « traite », « remède ».
2. Jamais affirmer un remboursement de manière générale. Formulation exacte si le sujet l'exige :
   de nombreuses complémentaires remboursent tout ou partie des séances lorsque le praticien est
   certifié ASCA, RME ou EMR, à vérifier auprès de sa caisse.
3. Aucun chiffre inventé (nombre de thérapeutes, cantons couverts, revenus, statistiques).
   Si Gérald ne te donne pas un chiffre, ne l'invente pas — pose la question ou reste vague.
4. Aucun nom de partenaire, date d'événement ou détail de collaboration non fourni par Gérald.
   Tu rédiges à partir de ce qu'il te donne, tu n'inventes jamais les faits eux-mêmes.
5. Tu ne publies rien. Tu proposes un brouillon qui reste « en attente de validation ».
6. Le fil Holiswiss s'adresse aux THÉRAPEUTES membres (audience interne), pas aux patients —
   ton informatif et direct, pas commercial.
7. Réponds en français, en markdown, de façon directe et actionnable. Pas de préambule.
`.trim();

async function callGateway(system: string, prompt: string): Promise<string> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");

  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText } = await import("ai");
  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: GATEWAY,
    headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  try {
    const r = await generateText({ model: provider(MODEL), system, prompt });
    return (r.text ?? "").trim();
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg.includes("402")) throw new Error("Crédits IA épuisés.");
    if (msg.includes("429")) throw new Error("Limite de requêtes atteinte, réessayez dans un instant.");
    throw new Error("L'agent Copywriter n'a pas pu répondre.");
  }
}

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ propositions */

/** Brouillons du fil en attente (ou refusés, pour garder le motif visible). */
export const listFilProposals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("articles")
      .select(
        "id,slug,slug_de,status,lang,category,title_fr,title_de,title_it,title_en," +
          "excerpt_fr,excerpt_de,excerpt_it,excerpt_en,body_fr,body_de,body_it,body_en," +
          "meta_title_fr,meta_description_fr,secondary_tags,is_featured," +
          "cover_image_url,image_alt_text,cover_image_credit_name,cover_image_credit_url,rejection_reason,created_at",
      )
      .in("category", FIL_CATEGORY_SLUGS)
      .in("status", ["pending_validation", "rejected"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { articles: (data ?? []) as any[] };
  });

/* ---------------------------------------------------------------- lecture */

export const listCopywriterThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("copywriter_agent_threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { threads: (data ?? []) as { id: string; title: string; updated_at: string }[] };
  });

export const getCopywriterThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("copywriter_agent_messages")
      .select("id,role,content,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: (rows ?? []) as any[] };
  });

export const deleteCopywriterThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("copywriter_agent_threads")
      .delete()
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------------------------------------------- demande */

export const askCopywriterAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        message: z.string().min(2).max(4000),
        threadId: z.string().uuid().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    let threadId = data.threadId ?? null;
    if (!threadId) {
      const title = data.message.replace(/\s+/g, " ").slice(0, 70);
      const { data: t, error } = await sb
        .from("copywriter_agent_threads")
        .insert({ title, created_by: context.userId })
        .select("id")
        .single();
      if (error || !t) throw new Error("Impossible de créer la conversation.");
      threadId = t.id as string;
    }

    const { data: history } = await sb
      .from("copywriter_agent_messages")
      .select("role,content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(12);

    const categories = FIL_CATEGORIES.map((c) => `- ${c.slug} : ${c.label.fr}`).join("\n");
    const system = [
      "Tu es l'agent Copywriter Actualités de Holiswiss, dédié à la page publique « Le fil Holiswiss ».",
      "Tu réponds à Gérald Henry, le fondateur.",
      "",
      GUARDRAILS,
      "",
      "## Catégories disponibles pour le fil",
      categories,
      "",
      "Pour chaque demande, rédige une proposition complète et lisible directement dans ta réponse :",
      "un titre, un chapô (2-3 phrases), le corps de l'article en markdown, et la catégorie choisie",
      "(indiquée clairement, ex. « Catégorie : fil-partenariats »).",
    ].join("\n");

    const conversation = ((history ?? []) as { role: string; content: string }[])
      .map((m) => `${m.role === "user" ? "GÉRALD" : "TOI"} : ${m.content}`)
      .join("\n\n");

    const prompt = conversation
      ? `Échanges précédents :\n\n${conversation}\n\nNouvelle demande de GÉRALD :\n${data.message}`
      : data.message;

    const answer = await callGateway(system, prompt);
    if (!answer) throw new Error("L'agent n'a rien renvoyé.");

    await sb.from("copywriter_agent_messages").insert([
      { thread_id: threadId, role: "user", content: data.message },
      { thread_id: threadId, role: "assistant", content: answer },
    ]);
    await sb
      .from("copywriter_agent_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    return { threadId, answer };
  });

/* --------------------------------------------------------- photo de couverture */

/**
 * Propose 3 photos Unsplash à partir du contenu d'une réponse — jamais de
 * sélection automatique : l'admin choisit toujours parmi ce qui est renvoyé ici.
 */
export const suggestCoverPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: msg } = await sb
      .from("copywriter_agent_messages")
      .select("content,role")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg || msg.role !== "assistant") throw new Error("Réponse introuvable.");

    const system = `Tu extrais des mots-clés visuels d'un article pour chercher une photo sur Unsplash.
Univers visuel Holiswiss : nature apaisante, bien-être, mains, lumière douce, cabinet de thérapeute suisse.
Réponds UNIQUEMENT par 2 à 3 mots-clés en anglais séparés par des espaces, sans phrase, sans ponctuation.`;
    const keywords = await callGateway(system, msg.content as string);
    const query = keywords.split(/\s+/).slice(0, 3).join(" ") || "wellness nature";

    const { searchUnsplashPhotos: search } = await import("@/lib/unsplash.functions");
    const result = await search({ data: { query } });
    return { query, photos: (result.results ?? []).slice(0, 3) };
  });

/* ------------------------------------------------- conversion en brouillon */

const ARTICLE_JSON_INSTRUCTIONS = `Tu convertis une réponse en brouillon d'article structuré pour « Le fil Holiswiss ».
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec ces clés :
{"category":"fil-nouveautes|fil-actualites|fil-partenariats|fil-portraits|fil-conseils|fil-holiswiss",
"title_fr":"…","excerpt_fr":"1-2 phrases, 300 caractères max","body_fr":"markdown complet",
"meta_title_fr":"60 caractères max","meta_description_fr":"155 caractères max"}
N'invente aucun fait, aucun chiffre, aucun nom absent de la source. Si le contenu ne correspond à
aucune actualité exploitable, renvoie {"error":"pas_une_actualite"}.`;

export const saveAnswerAsArticleDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        messageId: z.string().uuid(),
        coverImageUrl: z.string().url(),
        coverImageCreditName: z.string().min(1),
        coverImageCreditUrl: z.string().url(),
        imageAltText: z.string().min(1).max(125),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: msg } = await sb
      .from("copywriter_agent_messages")
      .select("content,role")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg || msg.role !== "assistant") throw new Error("Réponse introuvable.");

    const raw = await callGateway(ARTICLE_JSON_INSTRUCTIONS, msg.content as string);
    const parsed = extractJson(raw);
    if (!parsed || parsed.error) {
      throw new Error("Cette réponse n'est pas une actualité convertible en brouillon.");
    }

    const title = String(parsed.title_fr ?? "").trim();
    const body = String(parsed.body_fr ?? "").trim();
    if (!title || !body) throw new Error("Titre ou contenu manquant dans la réponse générée.");
    const category = FIL_CATEGORY_SLUGS.includes(parsed.category) ? parsed.category : "fil-actualites";

    const row = {
      title_fr: title.slice(0, 200),
      body_fr: body,
      excerpt_fr: String(parsed.excerpt_fr ?? "").slice(0, 300) || title.slice(0, 150),
      meta_title_fr: String(parsed.meta_title_fr ?? title).slice(0, 70),
      meta_description_fr: String(parsed.meta_description_fr ?? "").slice(0, 180),
      category,
      slug: toSlug(title).slice(0, 140),
      lang: "fr",
      status: "pending_validation",
      cover_image_url: data.coverImageUrl,
      cover_image_credit_name: data.coverImageCreditName,
      cover_image_credit_url: data.coverImageCreditUrl,
      image_alt_text: data.imageAltText,
      author_id: context.userId,
      published_at: null,
    };

    const { data: created, error } = await sb
      .from("articles")
      .insert(row)
      .select("id,slug")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Un article avec ce titre (slug) existe déjà — reformulez le titre.");
      throw new Error("Enregistrement du brouillon impossible.");
    }
    return { id: created.id as string, slug: created.slug as string };
  });
