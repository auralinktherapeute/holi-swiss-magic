const LOGO_URL =
  "https://holiswiss.ch/__l5e/assets-v1/9ed4a73c-cb78-460c-aa00-d6966417b47d/lotus-transparent.png";
const SITE_URL = "https://holiswiss.ch";
const FROM = "Holiswiss <noreply@holiswiss.ch>";
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type StatusKind = "active" | "rejected" | "suspended";

function wrap(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#080514;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#080514;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#0f0a1e;border-radius:16px;overflow:hidden;border:1px solid rgba(184,110,249,0.25);">
        <tr><td style="background:linear-gradient(135deg,#1a0533,#0f0a1e);padding:32px 24px 24px;text-align:center;">
          <img src="${LOGO_URL}" alt="Holiswiss.ch" width="110" style="display:block;margin:0 auto 14px;max-width:110px;height:auto;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:28px;color:rgba(255,255,255,0.9);font-size:15px;line-height:1.7;">${bodyHtml}</td></tr>
        <tr><td style="background:#080514;padding:18px;text-align:center;color:rgba(255,255,255,0.45);font-size:12px;">© 2026 Holiswiss.ch — <a href="${SITE_URL}" style="color:rgba(184,110,249,0.7);text-decoration:none;">holiswiss.ch</a></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildEmail(args: {
  status: StatusKind;
  firstName?: string;
  slug?: string;
  reason?: string;
}): { subject: string; html: string } {
  const hello = args.firstName ? `Bonjour ${escapeHtml(args.firstName)},` : "Bonjour,";
  const profileUrl = args.slug ? `${SITE_URL}/fr/therapeute/${args.slug}` : SITE_URL;
  const reasonBlock = args.reason
    ? `<div style="margin-top:16px;background:rgba(255,255,255,0.05);border-left:3px solid #b86ef9;border-radius:6px;padding:12px 14px;"><strong style="color:#b86ef9;">Motif :</strong><br>${escapeHtml(args.reason).replace(/\n/g, "<br>")}</div>`
    : "";

  if (args.status === "active") {
    return {
      subject: "✅ Votre profil Holiswiss.ch est validé",
      html: wrap(
        "✨ Votre profil est en ligne !",
        `<p>${hello}</p>
         <p>Excellente nouvelle : votre profil thérapeute a été <strong style="color:#86efac;">validé</strong> par notre équipe et est désormais visible publiquement sur Holiswiss.ch.</p>
         <p>Les visiteurs peuvent vous découvrir, consulter votre profil et vous contacter pour prendre rendez-vous.</p>
         <p style="text-align:center;margin:28px 0;">
           <a href="${profileUrl}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:linear-gradient(135deg,#b86ef9,#5cc8fa);color:#fff;font-weight:700;text-decoration:none;">Voir mon profil →</a>
         </p>
         <p style="color:rgba(255,255,255,0.65);font-size:13.5px;">Pensez à compléter régulièrement vos disponibilités depuis votre tableau de bord.</p>`,
      ),
    };
  }

  if (args.status === "rejected") {
    return {
      subject: "Suite à votre demande Holiswiss.ch",
      html: wrap(
        "Votre demande d'inscription",
        `<p>${hello}</p>
         <p>Après examen attentif de votre candidature, nous ne sommes malheureusement pas en mesure de valider votre profil sur Holiswiss.ch pour le moment.</p>
         ${reasonBlock}
         <p style="margin-top:18px;">Vous pouvez nous contacter à <a href="mailto:contact@holiswiss.ch" style="color:#5cc8fa;">contact@holiswiss.ch</a> pour toute question ou pour soumettre des éléments complémentaires.</p>
         <p>Nous vous remercions de l'intérêt porté à Holiswiss.</p>`,
      ),
    };
  }

  return {
    subject: "⏸ Votre profil Holiswiss.ch a été suspendu",
    html: wrap(
      "Votre profil a été suspendu",
      `<p>${hello}</p>
       <p>Nous vous informons que votre profil thérapeute sur Holiswiss.ch a été <strong style="color:#fbbf24;">temporairement suspendu</strong>. Il n'est plus visible publiquement.</p>
       ${reasonBlock}
       <p style="margin-top:18px;">Pour en discuter ou demander la réactivation, contactez-nous à <a href="mailto:contact@holiswiss.ch" style="color:#5cc8fa;">contact@holiswiss.ch</a>.</p>`,
    ),
  };
}

export async function sendTherapistStatusEmail(args: {
  to: string;
  firstName?: string;
  lastName?: string;
  slug?: string;
  status: StatusKind;
  reason?: string;
}): Promise<{ ok: boolean; status: number; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    console.error("[therapist-status-email] missing credentials");
    return { ok: false, status: 0, error: "missing_credentials" };
  }
  const { subject, html } = buildEmail(args);
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
      console.error("[therapist-status-email] resend failed", res.status, text);
      return { ok: false, status: res.status, error: text.slice(0, 500) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    console.error("[therapist-status-email] fetch error", e);
    return { ok: false, status: 0, error: String(e) };
  }
}