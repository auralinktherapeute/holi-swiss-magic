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

export const Route = createFileRoute("/api/public/admin-notify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("apikey") !== EXPECTED_APIKEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { kind?: string; subject?: string; summary?: string; link?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const subject = body.subject ?? "Nouvelle activité sur HoliSwiss";
        const summary = body.summary ?? "";
        const link = body.link ? SITE_URL + body.link : SITE_URL + "/admin";

        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
          console.error("[admin-notify] missing email credentials");
          return new Response("Email not configured", { status: 500 });
        }

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
            body: JSON.stringify({
              from: FROM,
              to: [ADMIN_EMAIL],
              subject,
              html,
            }),
          });
          if (!r.ok) {
            const txt = await r.text();
            console.error("[admin-notify] resend failed", r.status, txt);
            return new Response("Send failed", { status: 502 });
          }
          return Response.json({ ok: true });
        } catch (e) {
          console.error("[admin-notify] error", e);
          return new Response("Send error", { status: 500 });
        }
      },
    },
  },
});