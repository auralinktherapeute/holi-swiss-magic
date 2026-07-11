// Envoi d'emails via le gateway Resend (déclenché manuellement par le thérapeute).

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "HoliSwiss <contact@holiswiss.ch>";
const LOGO_URL = "https://holiswiss.ch/__l5e/assets-v1/b34e4e20-5d40-4759-bd7c-aefb0fa59668/lotus-logo.png";

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}

function shell(inner: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:#f5f2ef;"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6ded4;">
    <tr><td style="padding:24px 24px 8px;text-align:center;">
      <img src="${LOGO_URL}" alt="HoliSwiss" width="72" style="display:block;margin:0 auto 8px;height:auto;">
      <div style="color:#6B7B5E;font-size:12px;letter-spacing:2px;text-transform:uppercase;">HoliSwiss</div>
    </td></tr>
    <tr><td style="padding:24px 28px 32px;color:#333;font-size:15px;line-height:1.65;">${inner}</td></tr>
    <tr><td style="background:#faf7f2;padding:16px;text-align:center;color:#8a8377;font-size:12px;">© 2026 HoliSwiss · <a href="https://holiswiss.ch" style="color:#6B7B5E;text-decoration:none;">holiswiss.ch</a></td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

async function send(payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) return { ok: false, status: 0, error: "missing_credentials" };
  try {
    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({ from: FROM, ...payload }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text.slice(0, 300) };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

export async function sendInvoiceEmail(args: {
  to: string;
  therapistName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  viewUrl: string;
  message?: string | null;
  attachmentHtmlBase64?: string;
}) {
  const subject = `Facture ${args.invoiceNumber} — ${args.therapistName}`;
  const inner = `
    <h2 style="margin:0 0 12px;color:#1c1c1e;font-size:20px;">Votre facture est disponible</h2>
    <p style="margin:0 0 14px;">Bonjour,</p>
    <p style="margin:0 0 14px;">Vous trouverez ci-joint la facture <strong>${escapeHtml(args.invoiceNumber)}</strong> d'un montant de <strong>${args.amount.toFixed(2)} ${escapeHtml(args.currency)}</strong>, incluant le bulletin QR-facture suisse.</p>
    ${args.message ? `<div style="background:#faf7f2;border-left:3px solid #6B7B5E;padding:12px 14px;margin:14px 0;border-radius:4px;">${escapeHtml(args.message).replace(/\n/g, "<br/>")}</div>` : ""}
    <p style="text-align:center;margin:24px 0;">
      <a href="${args.viewUrl}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#6B7B5E;color:#fff;font-weight:600;text-decoration:none;">Voir la facture en ligne</a>
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#666;">Émise par ${escapeHtml(args.therapistName)}<br/>Via HoliSwiss</p>
  `;
  const payload: Record<string, unknown> = { to: args.to, subject, html: shell(inner) };
  if (args.attachmentHtmlBase64) {
    payload.attachments = [{
      filename: `facture-${args.invoiceNumber}.html`,
      content: args.attachmentHtmlBase64,
    }];
  }
  return send(payload);
}

export async function sendQuestionnaireEmail(args: {
  to: string;
  therapistName: string;
  questionnaireTitle: string;
  link: string;
  message?: string | null;
}) {
  const subject = `${args.therapistName} vous invite à remplir : ${args.questionnaireTitle}`;
  const inner = `
    <h2 style="margin:0 0 12px;color:#1c1c1e;font-size:20px;">Questionnaire à remplir</h2>
    <p style="margin:0 0 14px;">Bonjour,</p>
    <p style="margin:0 0 14px;"><strong>${escapeHtml(args.therapistName)}</strong> vous invite à remplir le questionnaire suivant : <strong>${escapeHtml(args.questionnaireTitle)}</strong>.</p>
    ${args.message ? `<div style="background:#faf7f2;border-left:3px solid #6B7B5E;padding:12px 14px;margin:14px 0;border-radius:4px;">${escapeHtml(args.message).replace(/\n/g, "<br/>")}</div>` : ""}
    <p style="text-align:center;margin:24px 0;">
      <a href="${args.link}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#6B7B5E;color:#fff;font-weight:600;text-decoration:none;">Ouvrir le questionnaire</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#888;word-break:break-all;">Si le bouton ne fonctionne pas : ${escapeHtml(args.link)}</p>
  `;
  return send({ to: args.to, subject, html: shell(inner) });
}