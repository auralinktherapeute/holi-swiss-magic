// Nettoyage des traces d'IA dans un article — server function admin.
//
// Deux passes, dans cet ordre, et l'ordre compte :
//
//   1. UNICODE (déterministe, toutes langues, gratuit)
//      Retire les porteurs invisibles de `title/excerpt/body/meta` en fr, de,
//      it, en. Aucun appel modèle, aucun risque sur le sens. C'est la seule
//      passe qui tourne en mode "unicode".
//
//   2. STYLE (modèle, français uniquement)
//      Réécrit le corps français pour effacer les tics d'écriture LLM listés
//      par `detectStyleTells`. Le résultat n'est enregistré QUE s'il passe
//      quatre gardes — score SEO, score GEO, volume de texte, vocabulaire
//      LPMéd. Une réécriture qui dégrade quoi que ce soit est jetée et
//      l'article garde sa version précédente.
//
// La passe 1 est réappliquée après la passe 2 : un modèle réintroduit
// volontiers des insécables et des guillemets exotiques dans sa sortie.
//
// Le français est la seule langue réécrite : les traductions de/it/en sont
// dérivées du FR par `translateArticle`. Les réécrire séparément coûterait
// quatre fois plus cher et les ferait diverger de leur source.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";
import { computeSeo, computeGeo } from "@/lib/article-scoring";
import {
  ARTICLE_TEXT_FIELDS,
  computeAiMarks,
  detectStyleTells,
  stripInvisibleFromArticle,
  cleanInvisible,
  type ArticleTextRecord,
} from "@/lib/ai-watermarks";

const SELECT_COLUMNS = [
  "id",
  "slug",
  "category",
  "cover_image_url",
  "status",
  ...ARTICLE_TEXT_FIELDS,
].join(",");

/** Vocabulaire interdit par la LPMéd : un thérapeute non médecin ne « soigne »
 *  ni ne « guérit ». La réécriture ne doit jamais en introduire. */
const LPMED_FORBIDDEN =
  /\b(soin|soins|soigner|soigne|guérison|guérir|guérit|traitement|traiter|diagnostic|diagnostiquer|prescription|prescrire)\b/gi;

function countForbidden(text: string): number {
  return (text.match(LPMED_FORBIDDEN) ?? []).length;
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Champs que la passe 2 a le droit de réécrire. Garantie serveur : quoi que
 *  réponde le modèle, rien d'autre n'est appliqué. */
/**
 * Champs que la passe 2 a le droit de réécrire — le corps, et rien d'autre.
 *
 * Le titre (50–60 caractères) et la meta description (150–160) sont notés sur
 * des fourchettes exactes au caractère près. Le score SEO se déplace par pas
 * de 10 (dix critères à dix points), donc un titre qui sort de sa fourchette
 * coûte 10 points d'un coup et fait rejeter toute la réécriture par la garde.
 * Sur un article à 100/100 cela rendait la passe 2 quasi inopérante.
 *
 * Les tics d'écriture vivent de toute façon dans le corps ; le titre et la
 * meta n'en portent presque jamais.
 */
const REWRITABLE = ["body_fr"] as const;

export const inspectArticleAiMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("articles")
      .select(SELECT_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Article introuvable.");
    return computeAiMarks(row as ArticleTextRecord);
  });

export const cleanArticleAiMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      /** "unicode" = passe 1 seule (instantanée, gratuite). "full" = les deux. */
      mode: z.enum(["unicode", "full"]).default("full"),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await (supabaseAdmin as any)
      .from("articles")
      .select(SELECT_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Article introuvable.");

    const before = computeAiMarks(row as ArticleTextRecord);
    const seoBefore = computeSeo(row).score;
    const geoBefore = computeGeo(row).score;

    const patch: Record<string, unknown> = {};

    // ── Passe 1 : Unicode, toutes langues ───────────────────────────────────
    const pass1 = stripInvisibleFromArticle(row as ArticleTextRecord);
    Object.assign(patch, pass1.patch);

    // État courant de l'article = ligne en base + ce que la passe 1 a corrigé.
    let current: Record<string, any> = { ...row, ...pass1.patch };

    // ── Passe 2 : style, français ───────────────────────────────────────────
    // Seuls les motifs corrigeables déclenchent et guident la passe 2. Les
    // atouts de citabilité (H2 interrogatifs, listes) sont détectés ailleurs,
    // affichés à l'admin, et jamais soumis au modèle.
    const allTellsBefore = detectStyleTells(current.body_fr ?? "");
    const tellsBefore = allTellsBefore.filter((t) => !t.servesCitability);
    const citabilityAssets = allTellsBefore.filter((t) => t.servesCitability);
    let tellsAfter = tellsBefore;
    let rewritten = false;
    let rejectedReason: string | null = null;

    if (data.mode === "full" && tellsBefore.length > 0) {
      const lovableKey = process.env.LOVABLE_API_KEY;
      if (!lovableKey) throw new Error("LOVABLE_API_KEY manquant côté serveur.");

      const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
      const { generateText, Output } = await import("ai");
      const provider = createOpenAICompatible({
        name: "lovable",
        baseURL: "https://ai.gateway.lovable.dev/v1",
        headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      });

      const schema = z.object({ body_fr: z.string() });

      const system = `Vous êtes secrétaire de rédaction pour HoliSwiss (annuaire suisse de thérapeutes holistiques).
Votre travail : resserrer le style d'un article rédigé en français, sans en changer le fond. Vous chassez les tournures formulaires, les transitions toutes faites et les emphases creuses — le travail ordinaire d'une relecture éditoriale.

À PRÉSERVER ABSOLUMENT, même si cela vous paraît répétitif : les intertitres formulés en question, les listes à puces, les tableaux, les phrases définitionnelles « X est Y », et la réponse directe placée juste sous chaque intertitre. Ces formes sont ce qui rend un passage citable par les moteurs de réponse (ChatGPT, AI Overviews, Perplexity) : les effacer coûterait de la visibilité. Vous ne touchez ni au titre, ni au chapô, ni aux métadonnées.

CE QUI NE DOIT PAS BOUGER : les faits, les chiffres, les noms de villes et de cantons suisses, les liens Markdown (URL comprises), la structure des titres (##, ###), la longueur globale du texte, le sujet et l'angle.

CE QUI DOIT CHANGER : la cadence et les tournures. Phrases de longueurs franchement inégales. Transitions concrètes plutôt que formulaires. Verbes précis plutôt qu'adjectifs d'emphase.

CONTRAINTE LÉGALE (LPMéd) : les mots « soin », « soigner », « guérison », « guérir », « traitement », « traiter », « diagnostic », « prescription » sont interdits. Utiliser « accompagnement », « approche », « pratique », « séance », « bien-être », « équilibre ».

Répondre en français. Ne jamais produire de HTML. Ne jamais ajouter de note ni de commentaire sur le travail effectué.`;

      const instructions = tellsBefore
        .map(
          (t) =>
            `- ${t.instruction} (${t.count} occurrence${t.count > 1 ? "s" : ""}${t.samples.length ? ` : ${t.samples.join(" / ")}` : ""})`,
        )
        .join("\n");

      const nbListes = citabilityAssets.reduce((n, t) => n + t.count, 0);

      const prompt = `Reprends le style du CORPS de cet article sur les points ci-dessous, et uniquement ceux-là. Tu ne renvoies que le corps.

TITRE (pour contexte, ne pas modifier) : ${current.title_fr ?? ""}

CORPS (Markdown) :
${current.body_fr ?? ""}

POINTS DE STYLE À REPRENDRE :
${instructions}

CONTRAINTES DE FORME (mesurées par un programme, au mot près) :
1. Au moins ${Math.max(320, Math.round(wordCount(current.body_fr ?? "") * 0.95))} mots.
2. Au moins 2 titres « ## » et 1 titre « ### ». Tous les liens internes conservés à l'identique.
3. Conserver au moins 4 villes suisses distinctes, 3 cantons distincts, et les mots « suisse » et « romande ».
4. Longueur moyenne des phrases entre 10 et 25 mots. C'est mesuré : sortir de cette fourchette fait rejeter tout le travail.
5. Conserver les ${nbListes || "éventuelles"} structures énumératives et les intertitres formulés en question. Ce sont des atouts de référencement, pas des maladresses.`;

      let candidate: z.infer<typeof schema> | null = null;
      try {
        const result = await generateText({
          model: provider("google/gemini-3-flash-preview"),
          system,
          prompt,
          experimental_output: Output.object({ schema }),
        });
        candidate = (result as any).experimental_output ?? null;
        if (!candidate) {
          // Pas d'exception, mais rien d'exploitable : refus du modèle, coupure
          // sur la limite de jetons, ou JSON tronqué. `finishReason` distingue
          // les trois — sans lui, la panne n'est pas diagnosticable.
          const fr = (result as any)?.finishReason ?? "inconnu";
          const txt = String((result as any)?.text ?? "")
            .trim()
            .slice(0, 160);
          rejectedReason = `Le modèle a répondu sans contenu exploitable (finishReason : ${fr}${txt ? `, début : « ${txt} »` : ""}). Seule la passe Unicode a été appliquée.`;
        }
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.includes("429"))
          throw new Error("Limite de requêtes IA atteinte. Réessayez dans une minute.");
        if (msg.includes("402"))
          throw new Error("Crédits IA épuisés. Rechargez votre workspace Lovable.");
        // Le message brut est la seule information exploitable côté admin.
        // Le masquer, comme le faisait la première version, rendait toute
        // panne du modèle indiscernable d'une autre.
        rejectedReason = `Appel au modèle en échec : ${msg.slice(0, 300)}`;
      }

      if (candidate) {
        // Passe 1 réappliquée sur la sortie du modèle avant toute évaluation.
        const proposed: Record<string, any> = { ...current };
        for (const f of REWRITABLE) {
          const v = (candidate as Record<string, unknown>)[f];
          if (typeof v === "string" && v.trim()) proposed[f] = cleanInvisible(v.trim()).text;
        }

        // Quatre gardes. Une seule qui échoue et la réécriture est jetée.
        const seoAfter = computeSeo(proposed).score;
        const geoAfter = computeGeo(proposed).score;
        const wordsBefore = wordCount(current.body_fr ?? "");
        const wordsAfter = wordCount(proposed.body_fr ?? "");
        const forbiddenBefore = countForbidden(current.body_fr ?? "");
        const forbiddenAfter = countForbidden(proposed.body_fr ?? "");

        if (seoAfter < seoBefore) {
          rejectedReason = `Réécriture rejetée : le score SEO tombait de ${seoBefore} à ${seoAfter}.`;
        } else if (geoAfter < geoBefore) {
          rejectedReason = `Réécriture rejetée : le score GEO tombait de ${geoBefore} à ${geoAfter}.`;
        } else if (wordsAfter < wordsBefore * 0.85) {
          rejectedReason = `Réécriture rejetée : le texte perdait ${wordsBefore - wordsAfter} mots sur ${wordsBefore}.`;
        } else if (forbiddenAfter > forbiddenBefore) {
          rejectedReason = "Réécriture rejetée : vocabulaire interdit par la LPMéd réintroduit.";
        } else {
          for (const f of REWRITABLE) {
            if (proposed[f] !== current[f]) patch[f] = proposed[f];
          }
          current = proposed;
          rewritten = true;
          tellsAfter = detectStyleTells(current.body_fr ?? "").filter((t) => !t.servesCitability);
        }
      }
    }

    const changedFields = Object.keys(patch);
    if (changedFields.length > 0) {
      patch.updated_at = new Date().toISOString();
      const { error: upError } = await (supabaseAdmin as any)
        .from("articles")
        .update(patch)
        .eq("id", data.id);
      if (upError) throw new Error(`Enregistrement échoué : ${upError.message}`);
    }

    const after = computeAiMarks(current as ArticleTextRecord);

    return {
      updated: changedFields.length > 0,
      changedFields: changedFields.filter((f) => f !== "updated_at"),
      invisible: {
        removed: pass1.removed,
        replaced: pass1.replaced,
        fieldsBefore: before.invisibleFields,
        hits: before.invisibleHits.map((h) => ({ label: h.label, count: h.count, kind: h.kind })),
      },
      style: {
        rewritten,
        rejectedReason,
        before: tellsBefore.map((t) => ({ label: t.label, count: t.count })),
        after: tellsAfter.map((t) => ({ label: t.label, count: t.count })),
      },
      seoBefore,
      seoAfter: computeSeo(current).score,
      geoBefore,
      geoAfter: computeGeo(current).score,
      remainingMarks: after.invisibleCount + after.styleCount,
    };
  });
