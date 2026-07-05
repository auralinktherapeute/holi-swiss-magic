const ADMIN_EMAIL = "contact@holiswiss.ch";
const FROM = "HoliSwiss Alerts <alerts@holiswiss.ch>";
const SITE_URL = "https://holiswiss.ch";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ChannelResult = { ok: boolean; id?: string; error?: string; skipped?: boolean };

/** Numéro WhatsApp admin : app_settings (réglé dans le dashboard) prioritaire, sinon env. */
export async function resolveWhatsappTarget(): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("value")
      .eq("key", "admin_whatsapp_to")
      .maybeSingle();
    if (typeof data?.value === "string" && data.value) return data.value;
  } catch {
    // fallback env ci-dessous
  }
  return process.env.ADMIN_WHATSAPP_TO ?? null;
}

export async function sendAdminEmail(subject: string, summary: string, link: string): Promise<ChannelResult> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY_1 ?? process.env.RESEND_API_KEY;
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
    return { ok: true, id: j.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "fetch_error" };
  }
}

export async function sendAdminWhatsApp(subject: string, summary: string, link: string): Promise<ChannelResult> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
  const from = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886"; // sandbox default
  const to = await resolveWhatsappTarget();
  if (!LOVABLE_API_KEY) return { ok: false, skipped: true, error: "lovable_key_missing" };
  if (!TWILIO_API_KEY) return { ok: false, skipped: true, error: "twilio_key_missing" };
  if (!to) return { ok: false, skipped: true, error: "whatsapp_target_missing" };
  const toFormatted = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const body = `HoliSwiss\n${subject}\n${summary}\n${link}`.slice(0, 1500);
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
    if (!r.ok) return { ok: false, error: `twilio_${r.status}${j.code ? `_${j.code}` : ""}:${(j.message ?? "").slice(0, 160)}` };
    return { ok: true, id: j.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "fetch_error" };
  }
}

/** Envoie email + WhatsApp et retourne le résultat détaillé de chaque canal. */
export async function notifyAdmin(payload: { subject: string; summary: string; link?: string }) {
  const link = payload.link ? SITE_URL + payload.link : `${SITE_URL}/admin`;
  const [email, whatsapp] = await Promise.all([
    sendAdminEmail(payload.subject, payload.summary, link),
    sendAdminWhatsApp(payload.subject, payload.summary, link),
  ]);
  return { ok: email.ok || whatsapp.ok, email, whatsapp };
}
