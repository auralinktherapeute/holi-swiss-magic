// Email d'invitation « améliorez votre profil » envoyé au thérapeute par l'admin
// depuis l'agent Santé de Profil. Cadrage POSITIF. N'expose JAMAIS la citabilité IA
// (critère admin-only) — seules les actions visibles côté thérapeute sont incluses.

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "HoliSwiss <contact@holiswiss.ch>";
const SITE_URL = "https://holiswiss.ch";

export interface ProfileHealthEmailArgs {
  firstName: string;
  email: string;
  score: number;
  actions: { label: string; impact_points: number }[]; // top actions (hors citabilité IA)
  sentBy?: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildProfileHealthEmail(args: ProfileHealthEmailArgs): { subject: string; html: string } {
  const dashUrl = `${SITE_URL}/dashboard/profil`;
  const subject = `${esc(args.firstName)}, quelques minutes pour booster votre visibilité sur HoliSwiss`;
  const actionsHtml = args.actions
    .slice(0, 3)
    .map(
      (a) => `<li style="margin:0 0 8px;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.85);">
        ${esc(a.label)} <span style="color:#5cc8fa;font-weight:600;">+${a.impact_points} pts</span></li>`,
    )
    .join("");
  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#1a0a2e;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:20px;">
      <img src="${SITE_URL}/lotus-logo.png" alt="HoliSwiss" width="56" height="56" style="display:inline-block;" />
      <div style="font-size:20px;font-weight:700;color:#ffffff;margin-top:8px;">Holi<span style="color:#b86ef9;">Swiss</span></div>
    </div>
    <div style="background:#2d1248;border:1px solid rgba(184,110,249,0.25);border-radius:16px;padding:28px 24px;color:#ffffff;">
      <h1 style="margin:0 0 14px;font-size:20px;color:#ffffff;">Bonjour ${esc(args.firstName)},</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);">
        Bonne nouvelle : votre profil est <strong>bien parti</strong> — il est actuellement complété à
        <strong style="color:#5cc8fa;">${args.score}/100</strong>. Quelques ajustements simples suffisent
        pour le faire briller et gagner en visibilité (sur Google et auprès des patients).
      </p>
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#ffffff;">Vos actions les plus rentables :</p>
      <ul style="margin:0 0 22px;padding-left:18px;">${actionsHtml}</ul>
      <div style="text-align:center;">
        <a href="${dashUrl}" style="display:inline-block;background:linear-gradient(135deg,#b86ef9,#5cc8fa);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;">
          Compléter mon profil
        </a>
      </div>
    </div>
    <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.45);margin-top:20px;">
      HoliSwiss — Thérapeutes holistiques en Suisse · <a href="${SITE_URL}" style="color:#b86ef9;text-decoration:none;">holiswiss.ch</a>
    </p>
  </div>
</body>
</html>`;
  return { subject, html };
}

export async function sendProfileHealthEmail(args: ProfileHealthEmailArgs): Promise<{ sent: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { subject, html } = buildProfileHealthEmail(args);

  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY_1 ?? process.env.RESEND_API_KEY;

  let status = "sent";
  let errorMessage: string | null = null;

  if (!lovableKey || !resendKey) {
    status = "failed";
    errorMessage = "missing_credentials";
  } else {
    try {
      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({ from: FROM, to: args.email, subject, html }),
      });
      if (!res.ok) {
        status = "failed";
        errorMessage = `resend_${res.status}`;
      }
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message.slice(0, 280) : "fetch_error";
    }
  }

  try {
    await supabaseAdmin.from("email_logs").insert({
      waitlist_id: null,
      recipient_email: args.email,
      template_id: "profile_health_invite",
      subject,
      status,
      error_message: errorMessage,
      sent_by: args.sentBy ?? null,
    } as any);
  } catch {
    /* le journal ne doit pas casser l'envoi */
  }

  return { sent: status === "sent" };
}
