// Demande d'avis automatique après un rendez-vous terminé.
// Envoyé au patient quand le thérapeute marque la réservation « Terminée ».

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "HoliSwiss <contact@holiswiss.ch>";
const SITE_URL = "https://holiswiss.ch";

export interface ReviewRequestArgs {
  patientName: string;
  patientEmail: string;
  therapistName: string;
  therapistSlug: string;
  appointmentDate: string; // YYYY-MM-DD
  sentBy?: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildReviewRequestEmail(args: ReviewRequestArgs): { subject: string; html: string } {
  const reviewUrl = `${SITE_URL}/fr/therapeute/${args.therapistSlug}`;
  const prettyDate = args.appointmentDate.split("-").reverse().join(".");
  const subject = `Comment s'est passée votre séance avec ${args.therapistName} ?`;
  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#1a0a2e;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;padding-bottom:20px;">
      <img src="${SITE_URL}/lotus-logo.png" alt="HoliSwiss" width="56" height="56" style="display:inline-block;" />
      <div style="font-size:20px;font-weight:700;color:#ffffff;margin-top:8px;">Holi<span style="color:#b86ef9;">Swiss</span></div>
    </div>
    <div style="background:#2d1248;border:1px solid rgba(184,110,249,0.25);border-radius:16px;padding:28px 24px;color:#ffffff;">
      <h1 style="margin:0 0 14px;font-size:20px;color:#ffffff;">Bonjour ${esc(args.patientName)},</h1>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);">
        Votre séance du <strong>${esc(prettyDate)}</strong> avec <strong>${esc(args.therapistName)}</strong> est terminée.
        Votre retour compte : il aide d'autres personnes à trouver l'accompagnement qui leur convient,
        et soutient votre thérapeute.
      </p>
      <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);">
        Cela ne prend qu'une minute.
      </p>
      <div style="text-align:center;">
        <a href="${reviewUrl}" style="display:inline-block;background:linear-gradient(135deg,#b86ef9,#5cc8fa);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:10px;">
          Laisser un avis
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

/**
 * Envoie la demande d'avis (best-effort : les erreurs sont journalisées dans
 * email_logs mais ne doivent jamais bloquer la clôture du rendez-vous).
 */
export async function sendReviewRequestEmail(args: ReviewRequestArgs): Promise<{ sent: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { subject, html } = buildReviewRequestEmail(args);

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
        body: JSON.stringify({ from: FROM, to: args.patientEmail, subject, html }),
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

  await supabaseAdmin.from("email_logs").insert({
    waitlist_id: null,
    recipient_email: args.patientEmail,
    template_id: "review_request",
    subject,
    status,
    error_message: errorMessage,
    sent_by: args.sentBy ?? null,
  } as any);

  return { sent: status === "sent" };
}
