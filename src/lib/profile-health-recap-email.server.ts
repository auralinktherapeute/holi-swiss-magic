// Récapitulatif complet « Santé de Profil » envoyé au thérapeute par l'admin.
// Cadrage positif. N'inclut JAMAIS la citabilité IA (admin-only).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "HoliSwiss <contact@holiswiss.ch>";
const SITE_URL = "https://holiswiss.ch";

const CAT_LABEL: Record<string, string> = {
  completude: "Complétude du profil",
  contenu: "Contenu & preuves sociales",
  activite: "Activité récente",
  visibilite: "Visibilité SEO",
};
const CAT_MAX: Record<string, number> = { completude: 35, contenu: 25, activite: 20, visibilite: 20 };

export interface ProfileHealthRecapArgs {
  firstName: string;
  email: string;
  score: number;
  breakdown: { completude: number; contenu: number; activite: number; visibilite: number };
  strengths: { label: string }[];
  actions: { label: string; impact_points: number; category?: string }[];
  sentBy?: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildProfileHealthRecap(args: ProfileHealthRecapArgs): { subject: string; html: string } {
  const dashUrl = `${SITE_URL}/dashboard/profil`;
  const subject = `${args.firstName ? esc(args.firstName) + ", v" : "V"}otre récapitulatif de visibilité HoliSwiss (${args.score}/100)`;

  const strengthsHtml = args.strengths.length
    ? args.strengths
        .slice(0, 6)
        .map(
          (x) => `<li style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.85);">✅ ${esc(x.label)}</li>`,
        )
        .join("")
    : `<li style="font-size:13px;color:rgba(255,255,255,0.55);">À construire ensemble — les actions ci-dessous vous y aident.</li>`;

  const actionsHtml = args.actions
    .slice(0, 6)
    .map(
      (a) => `<li style="margin:0 0 10px;font-size:14px;line-height:1.55;color:rgba(255,255,255,0.9);">
        ${esc(a.label)}
        <span style="display:inline-block;margin-left:6px;padding:2px 8px;border-radius:999px;background:rgba(92,200,250,0.15);color:#5cc8fa;font-weight:600;font-size:12px;">+${a.impact_points} pts</span>
      </li>`,
    )
    .join("");

  const breakdownHtml = (["completude", "contenu", "activite", "visibilite"] as const)
    .map((k) => {
      const v = args.breakdown[k];
      const max = CAT_MAX[k];
      const pct = Math.round((v / max) * 100);
      const color = pct >= 75 ? "#22c55e" : pct >= 45 ? "#f59e0b" : "#ef4444";
      return `<tr>
        <td style="padding:6px 10px 6px 0;font-size:12px;color:rgba(255,255,255,0.75);width:45%;">${CAT_LABEL[k]}</td>
        <td style="padding:6px 0;">
          <div style="background:rgba(255,255,255,0.08);border-radius:6px;height:8px;width:100%;overflow:hidden;">
            <div style="background:${color};height:8px;width:${pct}%;"></div>
          </div>
        </td>
        <td style="padding:6px 0 6px 10px;font-size:12px;color:#ffffff;font-weight:600;text-align:right;white-space:nowrap;">${v}/${max}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#1a0a2e;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:20px;">
      <img src="${SITE_URL}/lotus-logo.png" alt="HoliSwiss" width="56" height="56" style="display:inline-block;" />
      <div style="font-size:20px;font-weight:700;color:#ffffff;margin-top:8px;">Holi<span style="color:#b86ef9;">Swiss</span></div>
    </div>

    <div style="background:#2d1248;border:1px solid rgba(184,110,249,0.25);border-radius:16px;padding:28px 24px;color:#ffffff;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#ffffff;">Bonjour ${esc(args.firstName || "")},</h1>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);">
        Voici votre récapitulatif de visibilité sur HoliSwiss. Score global :
        <strong style="color:#5cc8fa;font-size:16px;">${args.score}/100</strong>.
        Quelques actions ciblées suffisent pour progresser rapidement.
      </p>

      <h2 style="margin:22px 0 10px;font-size:14px;color:#b86ef9;text-transform:uppercase;letter-spacing:0.5px;">Détail par catégorie</h2>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;">
        ${breakdownHtml}
      </table>

      <h2 style="margin:22px 0 10px;font-size:14px;color:#22c55e;text-transform:uppercase;letter-spacing:0.5px;">Vos points forts</h2>
      <ul style="margin:0 0 12px;padding-left:18px;">${strengthsHtml}</ul>

      <h2 style="margin:22px 0 10px;font-size:14px;color:#5cc8fa;text-transform:uppercase;letter-spacing:0.5px;">Actions les plus rentables</h2>
      <ul style="margin:0 0 22px;padding-left:18px;">${actionsHtml}</ul>

      <div style="text-align:center;margin-top:8px;">
        <a href="${dashUrl}" style="display:inline-block;background:linear-gradient(135deg,#b86ef9,#5cc8fa);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;">
          Compléter mon profil
        </a>
      </div>

      <p style="margin:20px 0 0;font-size:12px;color:rgba(255,255,255,0.5);text-align:center;line-height:1.5;">
        Les indicateurs de visibilité liés à l'intelligence artificielle sont suivis en interne et ne sont pas inclus dans ce récapitulatif — seules les actions concrètes que vous pouvez faire vous-même y figurent.
      </p>
    </div>

    <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.45);margin-top:20px;">
      HoliSwiss — Thérapeutes holistiques en Suisse · <a href="${SITE_URL}" style="color:#b86ef9;text-decoration:none;">holiswiss.ch</a>
    </p>
  </div>
</body>
</html>`;
  return { subject, html };
}

export async function sendProfileHealthRecap(args: ProfileHealthRecapArgs): Promise<{ sent: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { subject, html } = buildProfileHealthRecap(args);

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
    await (supabaseAdmin as any).from("email_logs").insert({
      waitlist_id: null,
      recipient_email: args.email,
      template_id: "profile_health_recap",
      subject,
      status,
      error_message: errorMessage,
      sent_by: args.sentBy ?? null,
    });
  } catch {
    /* journal facultatif */
  }

  return { sent: status === "sent" };
}