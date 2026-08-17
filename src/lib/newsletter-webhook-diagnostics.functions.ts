// Diagnostic sécurisé du webhook Resend (admin uniquement).
// Ne renvoie aucune donnée client, aucun contenu d'email, aucun secret.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

/* eslint-disable @typescript-eslint/no-explicit-any -- tables newsletter absentes des types générés. */
type AnyClient = { from: (table: string) => any };

const PROBE_TO = "contact@holiswiss.ch";

async function admin(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as AnyClient;
}

export type WebhookEventRow = {
  id: string;
  received_at: string;
  occurred_at: string;
  event_type: string;
  provider_event_id: string;
  provider_message_id: string | null;
  status: string;
  detail: string | null;
};

/** Derniers événements webhook reçus (métadonnées techniques seulement). */
export const listWebhookEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const db = await admin();
    const { data: rows, error } = await db
      .from("newsletter_send_events")
      .select("id,created_at,occurred_at,event_type,provider_event_id,provider_message_id,detail,send_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error("Lecture des événements impossible.");
    const events: WebhookEventRow[] = ((rows ?? []) as any[]).map((r) => ({
      id: r.id,
      received_at: r.created_at,
      occurred_at: r.occurred_at,
      event_type: r.event_type,
      provider_event_id: r.provider_event_id,
      provider_message_id: r.provider_message_id,
      status: r.detail ? r.detail : r.send_id ? "traite" : "trace",
      detail: r.detail,
    }));
    return { events, secretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET) };
  });

/** Email de sonde envoyé uniquement à l'adresse administrateur configurée. */
export const sendWebhookProbeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { sendRawEmail } = await import("@/lib/holiswiss-email.server");
    const stamp = new Date().toISOString();
    const res = await sendRawEmail({
      to: PROBE_TO,
      subject: `[DIAGNOSTIC] Webhook Resend — ${stamp}`,
      html: `<p>Email de diagnostic Holiswiss.</p><p>Horodatage : ${stamp}</p>`,
    });
    return { ok: res.ok, status: res.status, messageId: res.id ?? null, to: PROBE_TO, error: res.error ?? null };
  });
