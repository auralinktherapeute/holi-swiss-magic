import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import { MARKETING_SKILLS } from "@/content/marketing-skills/registry";

/**
 * Agent marketing pilotable depuis /admin/marketing.
 *
 * Gérald écrit sa demande en français courant ; l'agent choisit lui-même la ou les
 * compétences pertinentes parmi les 46 disponibles, puis répond en s'appuyant sur
 * le socle de contexte Holiswiss. Il ne publie jamais rien : une réponse peut au
 * mieux être enregistrée comme proposition, qui reste soumise à validation.
 */

const MODEL = "google/gemini-3-flash-preview";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

/* ---------------------------------------------------------------- contexte */

// Le socle vit dans `.agents/product-marketing.md` : c'est le fichier que lisent
// aussi les agents Claude Code, donc une seule source de vérité pour les deux.
const CONTEXT_MODULES = import.meta.glob("/.agents/product-marketing.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const HOLISWISS_CONTEXT = Object.values(CONTEXT_MODULES)[0] ?? "";

// Corps des compétences : chargés à la demande, jamais tous en mémoire.
const SKILL_MODULES = import.meta.glob("../content/marketing-skills/*.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

async function loadSkill(name: string): Promise<string | null> {
  const key = Object.keys(SKILL_MODULES).find((k) => k.endsWith(`/${name}.md`));
  if (!key) return null;
  try {
    return await SKILL_MODULES[key]();
  } catch {
    return null;
  }
}

/** Règles que l'agent ne peut jamais enfreindre, quelle que soit la compétence. */
const GUARDRAILS = `
RÈGLES ABSOLUES — elles priment sur toute compétence :

1. Aucune allégation thérapeutique. Jamais « guérit », « soigne », « traite », « remède ».
   Employer « accompagne », « soutient », « favorise le bien-être ».
2. Jamais affirmer un remboursement. Formulation exacte : de nombreuses complémentaires
   remboursent tout ou partie des séances lorsque le praticien est certifié ASCA, RME ou EMR,
   à vérifier auprès de sa caisse. Les thérapies complémentaires ne relèvent pas de la LAMal de base.
3. Aucun chiffre inventé. Il n'existe AUCUNE donnée de revenus ou de gains pour les thérapeutes.
   Ne jamais laisser croire à une couverture nationale : 10 praticiens, 4 cantons au 27/07/2026.
4. Aucun témoignage, avis ou statistique fabriqué.
5. Tu ne publies rien et ne contactes aucun réseau social. Tu produis des propositions.
6. Distinguer toujours les deux audiences : réseaux sociaux et prospection s'adressent au
   THÉRAPEUTE à recruter ; blog et SEO s'adressent au PATIENT. Nommer la face visée.
7. Si une information te manque, la demander — ne jamais l'inventer.
8. Répondre en français, en markdown, de façon directe et actionnable. Pas de préambule.
`.trim();

/* ---------------------------------------------------------------- passerelle */

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
    throw new Error("L'agent marketing n'a pas pu répondre.");
  }
}

/** Choisit 1 à 3 compétences pertinentes pour la demande. */
async function routeSkills(message: string): Promise<string[]> {
  const catalogue = MARKETING_SKILLS.map(
    (s) => `- ${s.name}: ${s.description.slice(0, 260)}`,
  ).join("\n");

  const system = `Tu es un routeur. À partir d'une demande marketing, tu choisis les compétences les plus pertinentes dans le catalogue.
Réponds UNIQUEMENT par les noms exacts séparés par des virgules, sans phrase, sans ponctuation superflue.
Choisis 1 compétence si la demande est ciblée, 2 ou 3 si elle est large. Jamais plus de 3.`;

  const prompt = `CATALOGUE :\n${catalogue}\n\nDEMANDE :\n${message}\n\nCompétences :`;

  let raw = "";
  try {
    raw = await callGateway(system, prompt);
  } catch {
    return []; // le routage n'est pas critique : on répondra avec le seul socle
  }

  const valid = new Set(MARKETING_SKILLS.map((s) => s.name));
  const picked = raw
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/^[-*\s]+/, "").toLowerCase())
    .filter((s) => valid.has(s));

  return [...new Set(picked)].slice(0, 3);
}

/* ---------------------------------------------------------------- lecture */

export const listAgentThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("marketing_agent_threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { threads: (data ?? []) as { id: string; title: string; updated_at: string }[] };
  });

export const getAgentThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("marketing_agent_messages")
      .select("id,role,content,skills_used,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return { messages: (rows ?? []) as any[] };
  });

export const deleteAgentThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("marketing_agent_threads")
      .delete()
      .eq("id", data.threadId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------------------------------------------- demande */

export const askMarketingAgent = createServerFn({ method: "POST" })
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

    // 1. Fil de conversation
    let threadId = data.threadId ?? null;
    if (!threadId) {
      const title = data.message.replace(/\s+/g, " ").slice(0, 70);
      const { data: t, error } = await sb
        .from("marketing_agent_threads")
        .insert({ title, created_by: context.userId })
        .select("id")
        .single();
      if (error || !t) throw new Error("Impossible de créer la conversation.");
      threadId = t.id as string;
    }

    // 2. Historique (fenêtre courte : les échanges récents suffisent)
    const { data: history } = await sb
      .from("marketing_agent_messages")
      .select("role,content")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(12);

    // 3. Compétences mobilisées
    const skills = await routeSkills(data.message);
    const bodies: string[] = [];
    for (const name of skills) {
      const body = await loadSkill(name);
      if (body) bodies.push(`### Compétence « ${name} »\n\n${body}`);
    }

    // 4. Réponse
    const system = [
      "Tu es l'agent marketing de Holiswiss, annuaire suisse de thérapeutes en médecines douces.",
      "Tu réponds à Gérald Henry, le fondateur. Sois concret, honnête et directement actionnable.",
      "",
      GUARDRAILS,
      "",
      "## Contexte produit (source de vérité)",
      HOLISWISS_CONTEXT,
      bodies.length ? `\n## Compétences mobilisées\n\n${bodies.join("\n\n---\n\n")}` : "",
    ].join("\n");

    const conversation = ((history ?? []) as { role: string; content: string }[])
      .map((m) => `${m.role === "user" ? "GÉRALD" : "TOI"} : ${m.content}`)
      .join("\n\n");

    const prompt = conversation
      ? `Échanges précédents :\n\n${conversation}\n\nNouvelle demande de GÉRALD :\n${data.message}`
      : data.message;

    const answer = await callGateway(system, prompt);
    if (!answer) throw new Error("L'agent n'a rien renvoyé.");

    // 5. Persistance
    await sb.from("marketing_agent_messages").insert([
      { thread_id: threadId, role: "user", content: data.message },
      { thread_id: threadId, role: "assistant", content: answer, skills_used: skills },
    ]);
    await sb
      .from("marketing_agent_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);

    return { threadId, answer, skills };
  });

/* ------------------------------------------------- conversion en proposition */

function extractJson(text: string): any | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

/**
 * Transforme une réponse de l'agent en proposition de publication.
 * Elle entre dans le circuit existant au statut `en_attente_validation` :
 * rien n'est publié, la validation manuelle reste obligatoire.
 */
export const saveAnswerAsProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: msg } = await sb
      .from("marketing_agent_messages")
      .select("content,role")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg || msg.role !== "assistant") throw new Error("Réponse introuvable.");

    const system = `Tu convertis une réponse marketing en fiche de publication structurée pour Holiswiss.
Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, avec ces clés :
{"network":"instagram|linkedin|tiktok","pillar":"preuve_sociale|educatif|demo_outil|marque",
"angle":"…","format":"…","caption":"texte FR","caption_de":"…","caption_it":"…","caption_en":"…",
"hashtags":"…","hashtags_de":"…","hashtags_it":"…","hashtags_en":"…",
"visual_brief":"…","visual_prompt":"…","suggested_time":"18:30"}
N'invente aucun chiffre. Si une langue manque dans la source, produis-la en adaptant le message
(pas une traduction littérale). Si le contenu n'est pas une publication réseau social, renvoie {"error":"pas_une_publication"}.`;

    const raw = await callGateway(system, msg.content as string);
    const parsed = extractJson(raw);
    if (!parsed || parsed.error) {
      throw new Error("Cette réponse n'est pas une publication convertible en proposition.");
    }

    const networks = ["instagram", "linkedin", "tiktok"];
    const row = {
      network: networks.includes(parsed.network) ? parsed.network : "instagram",
      pillar: parsed.pillar ?? null,
      angle: parsed.angle ?? null,
      format: parsed.format ?? null,
      caption: String(parsed.caption ?? "").slice(0, 5000),
      caption_de: parsed.caption_de ?? null,
      caption_it: parsed.caption_it ?? null,
      caption_en: parsed.caption_en ?? null,
      hashtags: parsed.hashtags ?? null,
      hashtags_de: parsed.hashtags_de ?? null,
      hashtags_it: parsed.hashtags_it ?? null,
      hashtags_en: parsed.hashtags_en ?? null,
      visual_brief: parsed.visual_brief ?? null,
      visual_prompt: parsed.visual_prompt ?? null,
      suggested_time: parsed.suggested_time ?? null,
      lang: "fr",
      status: "en_attente_validation",
    };
    if (!row.caption) throw new Error("Aucune caption exploitable dans cette réponse.");

    const { data: created, error } = await sb
      .from("marketing_proposals")
      .insert(row)
      .select("id")
      .single();
    if (error || !created) throw new Error("Enregistrement de la proposition impossible.");
    return { id: created.id as string };
  });

/* ------------------------------------------- restructuration d'un carrousel */

/** Trames imposées par le nombre de pages (cf. demande du 28/08/2026). */
const PAGE_PLAN: Record<number, string[]> = {
  2: ["Accroche forte + message essentiel", "Bénéfice principal + appel à l'action"],
  3: [
    "Problème, accroche ou situation vécue",
    "Solution et bénéfices principaux",
    "Conclusion et appel à l'action",
  ],
  4: [
    "Accroche",
    "Problème ou contexte",
    "Solution et bénéfices",
    "Conclusion et appel à l'action",
  ],
  5: [
    "Accroche",
    "Problème ou situation",
    "Explication",
    "Bénéfices ou solution",
    "Appel à l'action",
  ],
};

const PRESENTATION_RULES: Record<string, string> = {
  classic: "Classique : une idée principale par page, texte court, structure claire et pédagogique.",
  condensed:
    "Condensée : regroupe intelligemment les idées, formulation très synthétique, aucune page presque vide.",
  storytelling:
    "Storytelling : accroche forte page 1, développement progressif, conclusion et appel à l'action en dernière page.",
  conversion:
    "Conversion : problème/besoin du thérapeute, solution Holiswiss, bénéfices concrets, appel à l'action net.",
};

/**
 * Réécrit UNIQUEMENT la structure d'une proposition existante : même sujet,
 * même réseau, même ton, mêmes informations — seuls la longueur, le découpage
 * et le nombre de pages changent. Le statut, les hashtags, le brief visuel et
 * la date ne sont pas touchés. Rien n'est publié.
 */
export const regenerateProposalStructure = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        pageCount: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
        presentation: z.enum(["classic", "condensed", "storytelling", "conversion"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: p } = await sb
      .from("marketing_proposals")
      .select(
        "id,network,angle,format,caption,caption_en,caption_de,caption_it,status,carousel_generation_version",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!p) throw new Error("Proposition introuvable.");
    if (p.status === "publie" || p.status === "refuse") {
      throw new Error("Une proposition publiée ou refusée ne peut plus être régénérée.");
    }

    const plan = PAGE_PLAN[data.pageCount]!;
    const langs: { key: string; code: string; label: string; source: string | null }[] = [
      { key: "caption", code: "fr", label: "français", source: p.caption ?? null },
      { key: "caption_en", code: "en", label: "anglais", source: p.caption_en ?? null },
      { key: "caption_de", code: "de", label: "allemand", source: p.caption_de ?? null },
      { key: "caption_it", code: "it", label: "italien", source: p.caption_it ?? null },
    ];

    const patch: Record<string, unknown> = {
      carousel_page_count: data.pageCount,
      carousel_presentation: data.presentation,
      carousel_generation_version: Number(p.carousel_generation_version ?? 1) + 1,
      updated_at: new Date().toISOString(),
    };

    for (const l of langs) {
      if (!l.source || !l.source.trim()) continue; // une langue absente le reste

      const system = [
        "Tu restructures un carrousel Instagram déjà rédigé pour Holiswiss.",
        "",
        GUARDRAILS,
        "",
        `Tu écris en ${l.label}. Tu conserves strictement le sujet, le réseau, le ton de marque`,
        "et toutes les informations importantes du texte source. Tu n'ajoutes aucune information nouvelle.",
        `Tu produis EXACTEMENT ${data.pageCount} pages, ni plus ni moins.`,
        "Trame imposée, une page par ligne du plan :",
        plan.map((s, i) => `Page ${i + 1} : ${s}`).join("\n"),
        PRESENTATION_RULES[data.presentation]!,
        "",
        "Contraintes : phrases courtes, aucune page presque vide, aucune répétition,",
        "la page 1 doit se comprendre seule et accrocher immédiatement,",
        "la dernière page contient toujours une conclusion ou un appel à l'action.",
        "",
        `FORMAT DE SORTIE : uniquement le texte des ${data.pageCount} pages, séparées par une ligne vide.`,
        "Aucun numéro de page, aucun titre, aucun hashtag, aucun commentaire.",
      ].join("\n");

      const raw = await callGateway(system, `TEXTE SOURCE :\n\n${l.source}`);
      const pages = raw
        .split(/\n\s*\n/)
        .map((s) => s.replace(/^\s*(?:page\s*\d+\s*[:.)-]\s*)/i, "").trim())
        .filter(Boolean);
      if (pages.length !== data.pageCount) {
        // On ne remplace jamais par un découpage faux : on signale plutôt.
        if (l.code === "fr") {
          throw new Error(
            `L'agent a renvoyé ${pages.length} page(s) au lieu de ${data.pageCount}. Réessayez.`,
          );
        }
        continue; // langue secondaire : on garde l'ancienne version
      }
      patch[l.key] = pages.join("\n\n");
    }

    const { error } = await sb.from("marketing_proposals").update(patch).eq("id", data.id);
    if (error) throw new Error("Impossible d'enregistrer la nouvelle structure.");
    return { ok: true, pageCount: data.pageCount, presentation: data.presentation };
  });
