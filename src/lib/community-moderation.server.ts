/**
 * Agent Modérateur IA des salons communautaires.
 * Appelé par le trigger SQL via /api/public/moderate-message.
 */
type AnyClient = any;

export type ModerationVerdict = {
  severity: "aucune" | "infraction" | "grave";
  rule: string | null;
  excerpt: string | null;
  reason: string | null;
  report_md: string;
};

const SYSTEM = `Tu es l'Agent Modérateur IA des salons professionnels Holiswiss (thérapeutes suisses).
Tu veilles au respect de la Charte de Bienveillance :
1. Respecter autrui  2. Écouter sans jugement  3. S'exprimer sans attaque personnelle ni sarcasme blessant
4. Confidentialité  5. Reconnaître ses erreurs  6. Signaler plutôt qu'affronter  7. Contribuer positivement

Tu signales : grossièretés, insultes, mépris, harcèlement, discrimination, menaces, propos dénigrants
envers une pratique ou un confrère, spam ou publicité agressive, divulgation de données confidentielles.

Tu ne signales PAS : un désaccord argumenté, une critique factuelle et respectueuse, une émotion exprimée
sans agressivité, un vocabulaire technique de thérapie.

Sévérité :
- "aucune" : rien à signaler.
- "infraction" : manquement modéré (ton sec, sarcasme, familiarité déplacée).
- "grave" : insulte, haine, discrimination, menace, harcèlement.

Réponds de façon factuelle et neutre, en français.`;

export async function moderateMessage(input: {
  messageId: string;
  content: string;
  userId: string;
  familyId: string | null;
}): Promise<ModerationVerdict | null> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) {
    console.error("[moderation] LOVABLE_API_KEY manquant");
    return null;
  }

  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  const { generateText, Output } = await import("ai");
  const { z } = await import("zod");

  const provider = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const schema = z.object({
    severity: z.enum(["aucune", "infraction", "grave"]),
    rule: z.string().nullable(),
    excerpt: z.string().nullable(),
    reason: z.string().nullable(),
    report_md: z.string(),
  });

  try {
    const result = await generateText({
      model: provider("google/gemini-3-flash-preview"),
      system: SYSTEM,
      prompt: `Analyse ce message de salon et rends ton verdict.

Message :
"""${input.content.slice(0, 4000)}"""

"report_md" : un court rapport markdown avec les sections **Gravité**, **Règle concernée**, **Extrait**, **Analyse**, **Action recommandée**. Si severity = "aucune", report_md peut être une seule ligne.`,
      experimental_output: Output.object({ schema }),
    });
    return (result as any).experimental_output as ModerationVerdict;
  } catch (e: any) {
    console.error("[moderation] appel IA échoué:", String(e?.message ?? e));
    return null;
  }
}

export async function applyModerationVerdict(
  input: { messageId: string; content: string; userId: string; familyId: string | null },
  verdict: ModerationVerdict,
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as AnyClient;

  if (verdict.severity === "aucune") {
    await admin
      .from("community_messages")
      .update({ moderated_at: new Date().toISOString() })
      .eq("id", input.messageId);
    return { flagged: false };
  }

  await admin
    .from("community_messages")
    .update({
      is_flagged: true,
      flagged_reason: verdict.reason ?? verdict.rule ?? "Manquement à la charte",
      moderation_severity: verdict.severity,
      moderated_at: new Date().toISOString(),
    })
    .eq("id", input.messageId);

  await admin.from("moderation_reports").insert({
    message_id: input.messageId,
    user_id: input.userId,
    family_id: input.familyId,
    severity: verdict.severity,
    rule: verdict.rule,
    excerpt: verdict.excerpt ?? input.content.slice(0, 280),
    report_md: verdict.report_md,
    status: "open",
  });

  try {
    await admin.rpc("create_admin_notification", {
      _kind: "community_moderation",
      _subject: verdict.severity === "grave" ? "Salon : manquement grave signalé" : "Salon : message signalé",
      _summary: (verdict.reason ?? verdict.rule ?? "Message signalé par l'agent modérateur").slice(0, 300),
      _link: "/admin/moderation",
      _entity_type: "community_message",
      _entity_id: input.messageId,
      _data: {},
    });
  } catch (e) {
    console.error("[moderation] notification admin échouée", e);
  }

  return { flagged: true };
}
