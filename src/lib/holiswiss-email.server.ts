// Envoi d'emails via le gateway Resend (déclenché manuellement par le thérapeute).

import { escapeHtml, emailShell } from "./email-shell.shared";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "HoliSwiss <contact@holiswiss.ch>";
const shell = emailShell;

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