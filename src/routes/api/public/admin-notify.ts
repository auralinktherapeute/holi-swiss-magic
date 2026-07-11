import { createFileRoute } from "@tanstack/react-router";
import { notifyAdmin, resolveWhatsappTarget } from "@/lib/admin-notify.server";

const ADMIN_EMAIL = "contact@holiswiss.ch";

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function loadExpectedSecret(): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("app_settings")
    .select("value")
    .eq("key", "admin_notify_secret")
    .maybeSingle();
  const v = data?.value;
  if (typeof v === "string" && v) return v;
  return null;
}

type Payload = {
  notification_id?: string;
  kind?: string;
  subject?: string;
  summary?: string;
  link?: string;
};

async function recordDelivery(
  notificationId: string | undefined,
  channel: "email" | "whatsapp",
  target: string,
  status: "sent" | "failed",
  errorMessage: string | null,
  providerId: string | null,
) {
  if (!notificationId) return;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("notification_deliveries").insert({
      notification_id: notificationId,
      channel,
      target,
      status,
      attempts: 1,
      error_message: errorMessage,
      provider_message_id: providerId,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    } as never);
  } catch (e) {
    console.error("[admin-notify] delivery log failed", e);
  }
}

export const Route = createFileRoute("/api/public/admin-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-admin-notify-secret") ?? "";
        const expected = await loadExpectedSecret();
        if (!expected || !timingSafeEqualStr(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: Payload;
        try {
          body = (await request.json()) as Payload;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const subject = body.subject ?? "Nouvelle activité sur HoliSwiss";
        const summary = body.summary ?? "";
        const notificationId = body.notification_id;

        const result = await notifyAdmin({ subject, summary, link: body.link });

        await recordDelivery(
          notificationId,
          "email",
          ADMIN_EMAIL,
          result.email.ok ? "sent" : "failed",
          result.email.ok ? null : result.email.error ?? "unknown",
          result.email.ok ? result.email.id ?? null : null,
        );
        if (!result.whatsapp.skipped) {
          await recordDelivery(
            notificationId,
            "whatsapp",
            (await resolveWhatsappTarget()) ?? "",
            result.whatsapp.ok ? "sent" : "failed",
            result.whatsapp.ok ? null : result.whatsapp.error ?? "unknown",
            result.whatsapp.ok ? result.whatsapp.id ?? null : null,
          );
        }

        // Résultat détaillé par canal (sans données sensibles) pour le diagnostic
        return Response.json({
          ok: result.ok,
          email: { ok: result.email.ok, error: result.email.ok ? undefined : result.email.error },
          whatsapp: {
            ok: result.whatsapp.ok,
            skipped: result.whatsapp.skipped ?? false,
            error: result.whatsapp.ok ? undefined : result.whatsapp.error,
          },
        });
      },
    },
  },
});
