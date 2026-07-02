import { createFileRoute } from "@tanstack/react-router";

const ADMIN_EMAIL = "contact@holiswiss.ch";
const FROM = "HoliSwiss <onboarding@resend.dev>";
const EXPECTED_APIKEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxd3VkbW5mYXZ2YXVrdWxkdWxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5OTg2MjUsImV4cCI6MjA5NjU3NDYyNX0.P-8PAwboYoul28Iqx_UMGH0c9_NPwBTsJPCkRMXKEpY";

const SITE_URL = "https://holiswiss.ch";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

async function sendEmail(subject: string, summary: string, link: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) return { ok: false, error: "missing_credentials" };
  const html = `
<!doctype html><html><body style="font-family:Inter,Arial,sans-serif;background:#f5f5f7;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #ececf0;">
    <div style="font-size:12px;letter-spacing:.08em;color:#b86ef9;font-weight:600;">HOLISWISS · ADMIN</div>
    <h1 style="font-size:20px;margin:8px 0 12px;color:#0d0820;">${escapeHtml(subject)}</h1>
    <p style="font-size:14px;color:#3c3756;line-height:1.55;margin:0 0 20px;">${escapeHtml(summary)}</p>
    <a href="${escapeHtml(link)}" style="display:inline-block;background:linear-gradient(135deg,#b86ef9,#5cc8fa);color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;font-size:14px;">Ouvrir l'admin</a>
    <p style="font-size:11px;color:#8a85a3;margin-top:24px;">Notification automatique HoliSwiss</p>
  </div>
</body></html>`;
  try {
    const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({ from: FROM, to: [ADMIN_EMAIL], subject, html }),
    });
    if (!r.ok) {
      const txt = await r.text();
      return { ok: false, error: `resend_${r.status}:${txt.slice(0, 200)}` };
    }
    const j = (await r.json().catch(() => ({}))) as { id?: string };
    return { ok: true as const, id: j.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "fetch_error" };
  }
}

async function sendWhatsApp(subject: string, summary: string, link: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886"; // sandbox default
  const to = process.env.ADMIN_WHATSAPP_TO;
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !to) {
    return { ok: false, skipped: true as const, error: "whatsapp_not_configured" };
  }
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const body = `🌿 HoliSwiss\n${subject}\n${summary}\n${link}`.slice(0, 1500);
  try {
    const r = await fetch("https://connector-gateway.lovable.dev/twilio/Messages.json", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: toFormatted, From: from, Body: body }),
    });
    const j = (await r.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!r.ok) return { ok: false, error: `twilio_${r.status}:${j.message ?? ""}` };
    return { ok: true as const, id: j.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "fetch_error" };
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
        const link = body.link ? SITE_URL + body.link : SITE_URL + "/admin";
        const notificationId = body.notification_id;

        const [email, whatsapp] = await Promise.allSettled([
          sendEmail(subject, summary, link),
          sendWhatsApp(subject, summary, link),
        ]);

        if (email.status === "fulfilled") {
          const v = email.value;
          await recordDelivery(
            notificationId,
            "email",
            ADMIN_EMAIL,
            v.ok ? "sent" : "failed",
            v.ok ? null : v.error ?? "unknown",
            v.ok ? v.id ?? null : null,
          );
        }
        if (whatsapp.status === "fulfilled" && !("skipped" in whatsapp.value && whatsapp.value.skipped)) {
          const v = whatsapp.value;
          await recordDelivery(
            notificationId,
            "whatsapp",
            process.env.ADMIN_WHATSAPP_TO ?? "",
            v.ok ? "sent" : "failed",
            v.ok ? null : v.error ?? "unknown",
            v.ok ? v.id ?? null : null,
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});