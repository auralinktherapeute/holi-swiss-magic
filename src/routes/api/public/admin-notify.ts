import { createFileRoute } from "@tanstack/react-router";
import { notifyAdmin, resolveWhatsappTarget } from "@/lib/admin-notify.server";

const ADMIN_EMAIL = "contact@holiswiss.ch";
const EXPECTED_APIKEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY";

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
        if (request.headers.get("apikey") !== EXPECTED_APIKEY) {
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
