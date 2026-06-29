const LOGO_URL =
  "https://holiswiss.ch/__l5e/assets-v1/b34e4e20-5d40-4759-bd7c-aefb0fa59668/lotus-logo.png";
const SITE_URL = "https://holiswiss.ch";
const FROM = "HoliSwiss <contact@holiswiss.ch>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildInvitationEmail(args: {
  firstName?: string | null;
  specialty?: string | null;
  invitationLink: string;
}): { subject: string; html: string } {
  const prenom = args.firstName ? escapeHtml(args.firstName) : "Cher(e) thérapeute";
  const specialite = args.specialty ? escapeHtml(args.specialty) : "holistique";
  const link = args.invitationLink;

  const subject = "✨ Votre place sur HoliSwiss est prête";
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#080514;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080514;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid rgba(184,110,249,0.25);">
        <tr><td style="background:linear-gradient(135deg,#1a0533,#0f0a1e);padding:36px 24px 28px;text-align:center;">
          <img src="${LOGO_URL}" alt="HoliSwiss" width="96" style="display:block;margin:0 auto 14px;max-width:96px;height:auto;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">HoliSwiss</h1>
          <p style="margin:6px 0 0;color:rgba(184,110,249,0.85);font-size:13px;">La référence suisse des thérapies holistiques</p>
        </td></tr>
        <tr><td style="padding:32px 28px;color:rgba(255,255,255,0.92);font-size:15px;line-height:1.7;">
          <h2 style="margin:0 0 14px;color:#ffffff;font-size:20px;font-weight:600;">Bonjour ${prenom} 👋</h2>
          <p style="margin:0 0 14px;">Vous vous êtes inscrit(e) sur notre liste d'attente en tant que thérapeute <strong>${specialite}</strong>.</p>
          <p style="margin:0 0 22px;">Bonne nouvelle : votre place est maintenant prête. 🎉</p>

          <div style="background:rgba(184,110,249,0.08);border:1px solid rgba(184,110,249,0.25);border-radius:12px;padding:18px 20px;margin:0 0 26px;">
            <p style="margin:0 0 12px;color:#b86ef9;font-weight:700;font-size:15px;">✨ Accès Fondateur — 100% gratuit jusqu'au lancement officiel</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;color:rgba(255,255,255,0.88);font-size:14px;line-height:1.85;">
              <tr><td style="padding:2px 0;">🌐 &nbsp;Visibilité immédiate auprès des patients suisses</td></tr>
              <tr><td style="padding:2px 0;">📅 &nbsp;Gestion des réservations en ligne intégrée</td></tr>
              <tr><td style="padding:2px 0;">🎨 &nbsp;Page profil personnalisée avec vos spécialités</td></tr>
              <tr><td style="padding:2px 0;">🏅 &nbsp;Badge exclusif "Thérapeute Fondateur" sur votre profil</td></tr>
              <tr><td style="padding:2px 0;">🚀 &nbsp;Accès prioritaire à toutes les nouvelles fonctionnalités</td></tr>
            </table>
          </div>

          <p style="text-align:center;margin:28px 0;">
            <a href="${link}" style="display:inline-block;padding:16px 32px;border-radius:999px;background:linear-gradient(135deg,#b86ef9,#5cc8fa);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;">👉 Créer mon profil gratuitement</a>
          </p>

          <p style="margin:18px 0 6px;font-size:12.5px;color:rgba(255,255,255,0.55);">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
          <p style="margin:0 0 22px;font-size:12.5px;word-break:break-all;"><a href="${link}" style="color:#b86ef9;text-decoration:none;">${link}</a></p>

          <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.7);">Cette invitation est personnelle et valable 30 jours.</p>
          <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.7);">Des questions ? Répondez directement à cet email — nous sommes là pour vous accompagner. 🤝</p>
        </td></tr>
        <tr><td style="background:#080514;padding:22px;text-align:center;color:rgba(255,255,255,0.55);font-size:12px;line-height:1.7;">
          <div style="margin-bottom:8px;color:rgba(255,255,255,0.75);">Avec bienveillance,<br><strong>L'équipe HoliSwiss</strong></div>
          <div><a href="mailto:contact@holiswiss.ch" style="color:rgba(184,110,249,0.85);text-decoration:none;">contact@holiswiss.ch</a> · <a href="${SITE_URL}" style="color:rgba(184,110,249,0.85);text-decoration:none;">holiswiss.ch</a></div>
          <div style="margin-top:10px;color:rgba(255,255,255,0.4);">© 2026 HoliSwiss · Suisse</div>
          <div style="margin-top:6px;color:rgba(255,255,255,0.35);font-size:11px;">Vous recevez cet email car vous êtes inscrit(e) sur notre liste d'attente.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  return { subject, html };
}

export async function sendInvitationEmail(args: {
  to: string;
  firstName?: string | null;
  specialty?: string | null;
  invitationLink: string;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.error("[invitation-email] missing credentials");
    return { ok: false, status: 0, error: "missing_credentials" };
  }
  const { subject, html } = buildInvitationEmail(args);
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({ from: FROM, to: args.to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[invitation-email] resend failed", res.status, text.slice(0, 200));
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    console.error("[invitation-email] fetch error", e);
    return { ok: false, status: 0, error: String(e) };
  }
}

export async function sendWelcomeEmail(args: {
  to: string;
  firstName?: string | null;
}): Promise<void> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) return;
  const prenom = args.firstName ? escapeHtml(args.firstName) : "";
  const subject = "🎉 Bienvenue sur HoliSwiss";
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#080514;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080514;padding:24px 12px;"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid rgba(184,110,249,0.25);">
      <tr><td style="background:linear-gradient(135deg,#1a0533,#0f0a1e);padding:32px;text-align:center;">
        <img src="${LOGO_URL}" alt="HoliSwiss" width="80" style="display:block;margin:0 auto 12px;max-width:80px;height:auto;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;">Votre compte est créé !</h1>
      </td></tr>
      <tr><td style="padding:28px;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.7;">
        <p>Bonjour ${prenom},</p>
        <p>Votre compte thérapeute HoliSwiss est désormais actif. Complétez votre profil pour devenir visible auprès des patients suisses.</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${SITE_URL}/dashboard" style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(135deg,#b86ef9,#5cc8fa);color:#fff;font-weight:700;text-decoration:none;">Accéder à mon tableau de bord →</a>
        </p>
      </td></tr>
      <tr><td style="background:#080514;padding:18px;text-align:center;color:rgba(255,255,255,0.45);font-size:12px;">© 2026 HoliSwiss · <a href="${SITE_URL}" style="color:rgba(184,110,249,0.7);text-decoration:none;">holiswiss.ch</a></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  try {
    await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({ from: FROM, to: args.to, subject, html }),
    });
  } catch (e) {
    console.error("[welcome-email] fetch error", e);
  }
}