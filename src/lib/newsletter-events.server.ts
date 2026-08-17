// Réception des événements Resend pour « La Lettre Holiswiss ».
// Vérification de signature Svix + idempotence + agrégation des compteurs.

import { createHmac, timingSafeEqual } from "crypto";

/* eslint-disable @typescript-eslint/no-explicit-any -- tables newsletter absentes des types générés. */
type AnyClient = { from: (table: string) => any };

const TOLERANCE_S = 5 * 60;

/** Vérifie la signature Svix utilisée par Resend (whsec_...). */
export function verifyResendSignature(
  rawBody: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  for (const part of signature.split(" ")) {
    const value = part.includes(",") ? part.slice(part.indexOf(",") + 1) : part;
    const given = Buffer.from(value);
    if (given.length === expectedBuf.length && timingSafeEqual(given, expectedBuf)) return true;
  }
  return false;
}

const TYPE_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.failed": "failed",
};

const COUNTER: Record<string, string> = {
  delivered: "delivered_count",
  bounced: "bounced_count",
  complained: "complained_count",
  opened: "opened_count",
  clicked: "clicked_count",
  failed: "failed_count",
};

const ONCE_PER_RECIPIENT = new Set(["delivered", "bounced", "complained", "opened", "clicked"]);

export type ResendEvent = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; [k: string]: unknown };
};

/**
 * Applique un événement au journal. Idempotent : un même provider_event_id
 * n'est jamais compté deux fois (index unique).
 */
export async function applyResendEvent(
  db: AnyClient,
  eventId: string,
  event: ResendEvent,
): Promise<{ handled: boolean; reason?: string }> {
  const type = TYPE_MAP[event.type ?? ""] ?? null;
  const messageId = (event.data?.email_id as string | undefined) ?? null;
  if (!type || !messageId) return { handled: false, reason: "ignored" };

  const { data: recipient } = await db
    .from("newsletter_send_recipients")
    .select("id,send_id,status,delivered_at,opened_at,clicked_at")
    .eq("provider_message_id", messageId)
    .maybeSingle();

  if (!recipient) return { handled: false, reason: "unknown_message" };

  const occurredAt = event.created_at
    ? new Date(event.created_at).toISOString()
    : new Date().toISOString();

  const { error: insertError } = await db.from("newsletter_send_events").insert({
    send_id: recipient.send_id,
    recipient_id: recipient.id,
    provider_message_id: messageId,
    provider_event_id: eventId,
    event_type: type,
    occurred_at: occurredAt,
  });

  // 23505 = événement déjà reçu : rien à recompter.
  if (insertError) {
    if ((insertError as { code?: string }).code === "23505")
      return { handled: true, reason: "duplicate" };
    throw new Error("Enregistrement de l'événement impossible.");
  }

  const patch: Record<string, unknown> = { last_event_type: type, last_event_at: occurredAt };
  let alreadyCounted = false;
  if (type === "delivered") {
    alreadyCounted = Boolean(recipient.delivered_at);
    patch.delivered_at = recipient.delivered_at ?? occurredAt;
    patch.status = "delivered";
  } else if (type === "opened") {
    alreadyCounted = Boolean(recipient.opened_at);
    patch.opened_at = recipient.opened_at ?? occurredAt;
  } else if (type === "clicked") {
    alreadyCounted = Boolean(recipient.clicked_at);
    patch.clicked_at = recipient.clicked_at ?? occurredAt;
  } else if (type === "bounced" || type === "complained" || type === "failed") {
    patch.status = type;
  }

  await db.from("newsletter_send_recipients").update(patch).eq("id", recipient.id);

  const counter = COUNTER[type];
  if (counter && !(ONCE_PER_RECIPIENT.has(type) && alreadyCounted)) {
    const { data: send } = await db
      .from("newsletter_sends")
      .select(`id,${counter}`)
      .eq("id", recipient.send_id)
      .maybeSingle();
    if (send) {
      await db
        .from("newsletter_sends")
        .update({
          [counter]: ((send as Record<string, number>)[counter] ?? 0) + 1,
          last_event_at: occurredAt,
        })
        .eq("id", recipient.send_id);
    }
  }

  return { handled: true };
}
