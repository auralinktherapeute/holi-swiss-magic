import { createServerFn } from "@tanstack/react-start";

const LOGO_URL =
  "https://holiswiss.ch/__l5e/assets-v1/9ed4a73c-cb78-460c-aa00-d6966417b47d/lotus-transparent.png";
const SITE_URL = "https://holiswiss.ch";
const ADMIN_EMAIL = "gerald.henry@me.com";
const FROM_THERAPIST = "Holiswiss <noreply@send.holiswiss.ch>";
const FROM_ADMIN = "Holiswiss Admin <noreply@send.holiswiss.ch>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function therapistTemplate(
  email: string,
  dateStr: string,
  firstName?: string,
  specialty?: string,
  canton?: string,
): string {
  const safeEmail = escapeHtml(email);
  const safeFirst = firstName ? escapeHtml(firstName) : "";
  const safeSpec = specialty ? escapeHtml(specialty) : "";
  const safeCanton = canton ? escapeHtml(canton) : "";
  const greeting = safeFirst ? `Bonjour ${safeFirst},` : "Bonjour,";
  const detailsBlock = `
              ${safeFirst ? `<div>👤&nbsp; <strong>Prénom :</strong> ${safeFirst}</div>` : ""}
              ${safeSpec ? `<div>🏷️&nbsp; <strong>Spécialité :</strong> ${safeSpec}</div>` : ""}
              ${safeCanton ? `<div>📍&nbsp; <strong>Canton :</strong> ${safeCanton}</div>` : ""}
              <div>📧&nbsp; <strong>Email :</strong> ${safeEmail}</div>
              <div>📅&nbsp; <strong>Date :</strong> ${escapeHtml(dateStr)}</div>
              <div>✅&nbsp; <strong>Inscription :</strong> Confirmée</div>`;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bienvenue sur Holiswiss</title></head>
<body style="margin:0;padding:0;background:#080514;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080514;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid rgba(184,110,249,0.25);">
        <tr><td style="background:linear-gradient(135deg,#1a0533,#0f0a1e);padding:36px 24px 28px;text-align:center;">
          <img src="${LOGO_URL}" alt="Holiswiss.ch" width="120" style="display:block;margin:0 auto 16px;max-width:120px;height:auto;">
          <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;line-height:1.25;">✨ Bienvenue sur Holiswiss&nbsp;!</h1>
          <p style="margin:10px 0 0;color:rgba(255,255,255,0.7);font-size:15px;">La plateforme suisse du bien-être holistique</p>
        </td></tr>
        <tr><td style="padding:32px 28px;color:#ffffff;">
          <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:rgba(255,255,255,0.92);">${greeting}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:rgba(255,255,255,0.8);">
            Votre demande d'inscription sur <strong style="color:#b86ef9;">Holiswiss.ch</strong> a bien été enregistrée. Vous faites partie des premiers thérapeutes à rejoindre la plateforme suisse du bien-être holistique.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1035;border:1px solid rgba(184,110,249,0.3);border-radius:12px;margin:20px 0;">
            <tr><td style="padding:18px 20px;font-size:14px;line-height:1.9;color:rgba(255,255,255,0.9);">${detailsBlock}</td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;margin:20px 0;">
            <tr><td style="padding:14px 16px;font-size:13.5px;line-height:1.6;color:#78350f;">
              <strong>💡 Astuce :</strong> Si vous ne trouvez pas cet email, pensez à vérifier votre dossier <strong>Spams</strong> ou <strong>Courrier indésirable</strong>. Ajoutez <strong>noreply@send.holiswiss.ch</strong> à vos contacts pour ne rien manquer.
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:28px auto 8px;">
            <tr><td style="border-radius:999px;background:linear-gradient(135deg,#b86ef9,#5cc8fa);">
              <a href="${SITE_URL}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:700;text-decoration:none;font-size:15px;border-radius:999px;">Visiter Holiswiss.ch →</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#080514;padding:22px 24px;text-align:center;">
          <p style="margin:0;color:rgba(255,255,255,0.45);font-size:12px;line-height:1.6;">
            © 2026 Holiswiss.ch · La plateforme des thérapeutes suisses<br>
            <a href="${SITE_URL}" style="color:rgba(184,110,249,0.7);text-decoration:none;">holiswiss.ch</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function adminTemplate(
  email: string,
  id: string,
  source: string,
  dateStr: string,
  position: number,
  total: number,
  extra?: {
    first_name?: string; last_name?: string; phone?: string;
    specialty?: string; canton?: string; message?: string;
  },
): string {
  const safeEmail = escapeHtml(email);
  const fullName = extra?.first_name || extra?.last_name
    ? escapeHtml(`${extra.first_name ?? ""} ${extra.last_name ?? ""}`.trim())
    : "";
  const extraRows = `
              ${fullName ? `<div>👤&nbsp; <strong>Nom :</strong> ${fullName}</div>` : ""}
              ${extra?.phone ? `<div>📱&nbsp; <strong>Téléphone :</strong> <a href="tel:${escapeHtml(extra.phone)}" style="color:#5cc8fa;text-decoration:none;">${escapeHtml(extra.phone)}</a></div>` : ""}
              ${extra?.specialty ? `<div>🏷️&nbsp; <strong>Spécialité :</strong> ${escapeHtml(extra.specialty)}</div>` : ""}
              ${extra?.canton ? `<div>📍&nbsp; <strong>Canton :</strong> ${escapeHtml(extra.canton)}</div>` : ""}`;
  const messageBlock = extra?.message
    ? `<div style="margin-top:16px;background:rgba(92,200,250,0.08);border-left:3px solid #5cc8fa;border-radius:6px;padding:12px 14px;font-size:13.5px;line-height:1.55;color:rgba(255,255,255,0.85);"><strong style="color:#5cc8fa;">Message :</strong><br>${escapeHtml(extra.message).replace(/\n/g, "<br>")}</div>`
    : "";
  const pct = Math.min(100, Math.round((total / 70) * 100));
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nouvel inscrit liste d'attente</title></head>
<body style="margin:0;padding:0;background:#080514;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080514;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid rgba(184,110,249,0.25);">
        <tr><td style="background:#1a0533;padding:28px 24px;text-align:center;">
          <img src="${LOGO_URL}" alt="Holiswiss.ch" width="100" style="display:block;margin:0 auto 12px;max-width:100px;height:auto;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">🔔 Nouvel inscrit sur la liste d'attente</h1>
        </td></tr>
        <tr><td style="padding:28px;color:#ffffff;">
          <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:rgba(255,255,255,0.85);">
            Un nouveau thérapeute vient de s'inscrire sur la liste d'attente Holiswiss.ch.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a1035;border:1px solid rgba(184,110,249,0.3);border-radius:12px;">
            <tr><td style="padding:18px 20px;font-size:14px;line-height:1.9;color:rgba(255,255,255,0.9);">
              <div>📧&nbsp; <strong>Email :</strong> <a href="mailto:${safeEmail}" style="color:#5cc8fa;text-decoration:none;">${safeEmail}</a></div>${extraRows}
              <div>🏷️&nbsp; <strong>Source :</strong> ${escapeHtml(source)}</div>
              <div>📅&nbsp; <strong>Inscrit le :</strong> ${escapeHtml(dateStr)}</div>
              <div>🆔&nbsp; <strong>ID :</strong> <span style="font-family:monospace;font-size:12px;color:rgba(255,255,255,0.7);">${escapeHtml(id)}</span></div>
              <div>📊&nbsp; <strong>Position :</strong> #${position}</div>
            </td></tr>
            ${messageBlock ? `<tr><td style="padding:0 20px 18px;">${messageBlock}</td></tr>` : ""}
          </table>
          <div style="margin:24px 0 8px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px;color:rgba(255,255,255,0.7);">
              <span><strong style="color:#b86ef9;">Total inscrits :</strong> ${total} / 70</span>
              <span>${pct}%</span>
            </div>
            <div style="background:rgba(255,255,255,0.08);border-radius:999px;height:8px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#b86ef9,#5cc8fa);border-radius:999px;"></div>
            </div>
          </div>
          <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:24px auto 4px;">
            <tr>
              <td style="border-radius:999px;background:linear-gradient(135deg,#b86ef9,#5cc8fa);padding:0;">
                <a href="${SITE_URL}/admin/liste-attente" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:600;text-decoration:none;font-size:14px;border-radius:999px;">Voir le dashboard →</a>
              </td>
              <td style="width:10px;">&nbsp;</td>
              <td style="border-radius:999px;border:1px solid rgba(184,110,249,0.5);">
                <a href="mailto:${safeEmail}" style="display:inline-block;padding:11px 22px;color:#b86ef9;font-weight:600;text-decoration:none;font-size:14px;border-radius:999px;">Répondre →</a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#080514;padding:18px 24px;text-align:center;">
          <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;">Notification automatique · Holiswiss Admin · 2026</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function sendOne(payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    return { ok: false, status: 0, error: "missing_credentials" };
  }
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[waitlist-email] resend failed", res.status, text);
      return { ok: false, status: res.status, error: text.slice(0, 500) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    console.error("[waitlist-email] fetch error", e);
    return { ok: false, status: 0, error: String(e) };
  }
}

export const sendWaitlistEmails = createServerFn({ method: "POST" })
  .inputValidator((data: {
    email: string; id?: string; source?: string;
    first_name?: string; last_name?: string; phone?: string;
    specialty?: string; canton?: string; message?: string;
  }) => {
    if (!data || typeof data.email !== "string") {
      throw new Error("invalid_input");
    }
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      throw new Error("invalid_email");
    }
    const s = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : undefined;
    return {
      email,
      id: typeof data.id === "string" ? data.id : "",
      source: typeof data.source === "string" ? data.source : "popup",
      first_name: s(data.first_name, 100),
      last_name: s(data.last_name, 100),
      phone: s(data.phone, 40),
      specialty: s(data.specialty, 100),
      canton: s(data.canton, 10),
      message: s(data.message, 500),
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Position + total
    const { count: total } = await supabaseAdmin
      .from("waiting_list")
      .select("*", { count: "exact", head: true });
    const totalCount = total ?? 0;

    let position = totalCount;
    let recordId = data.id;
    let createdAt = new Date();
    if (!recordId) {
      const { data: row } = await supabaseAdmin
        .from("waiting_list")
        .select("id, created_at")
        .eq("email", data.email)
        .maybeSingle();
      if (row) {
        recordId = row.id;
        createdAt = new Date(row.created_at);
      }
    } else {
      const { data: row } = await supabaseAdmin
        .from("waiting_list")
        .select("created_at")
        .eq("id", recordId)
        .maybeSingle();
      if (row?.created_at) createdAt = new Date(row.created_at);
    }

    const dateStr = createdAt.toLocaleString("fr-CH", {
      timeZone: "Europe/Zurich",
      dateStyle: "long",
      timeStyle: "short",
    });

    const therapist = await sendOne({
      from: FROM_THERAPIST,
      to: data.email,
      subject: "✨ Votre inscription Holiswiss.ch est confirmée",
      html: therapistTemplate(data.email, dateStr, data.first_name, data.specialty, data.canton),
    });

    const admin = await sendOne({
      from: FROM_ADMIN,
      to: ADMIN_EMAIL,
      subject: `🔔 Nouvel inscrit — ${data.first_name ? data.first_name + " " : ""}${data.email}`,
      html: adminTemplate(data.email, recordId || "—", data.source, dateStr, position, totalCount, {
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        specialty: data.specialty,
        canton: data.canton,
        message: data.message,
      }),
    });

    return {
      ok: therapist.ok && admin.ok,
      therapist,
      admin,
    };
  });