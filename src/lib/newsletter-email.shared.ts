// Rendu HTML de « La Lettre Holiswiss ».
// Utilise le gabarit email HoliSwiss existant (aucun second système de template).
import { escapeHtml, emailShell } from "./email-shell.shared";

export type NewsletterEmailInput = {
  subject: string;
  preheader?: string | null;
  intro?: string | null;
  body?: string | null;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  footer?: string | null;
  unsubscribeUrl?: string | null;
};

function paragraphs(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** Construit l'email complet (objet + HTML) d'une newsletter. */
export function renderNewsletterEmail(input: NewsletterEmailInput): {
  subject: string;
  html: string;
} {
  const subject = input.subject?.trim() || "La Lettre Holiswiss";
  const unsubscribe = input.unsubscribeUrl || "https://holiswiss.ch/desinscription";

  const preheader = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>`
    : "";

  const button =
    input.buttonLabel && input.buttonUrl
      ? `<p style="text-align:center;margin:26px 0;">
      <a href="${escapeHtml(input.buttonUrl)}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#6B7B5E;color:#ffffff;font-weight:600;text-decoration:none;">${escapeHtml(input.buttonLabel)}</a>
    </p>`
      : "";

  const legal = input.footer
    ? `<p style="margin:18px 0 0;font-size:12px;color:#8a8377;line-height:1.6;">${escapeHtml(input.footer).replace(/\n/g, "<br/>")}</p>`
    : "";

  const inner = `${preheader}
    <div style="color:#6B7B5E;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 10px;">La Lettre Holiswiss</div>
    <h1 style="margin:0 0 16px;color:#1c1c1e;font-size:22px;line-height:1.3;">${escapeHtml(subject)}</h1>
    ${paragraphs(input.intro)}
    ${paragraphs(input.body)}
    ${button}
    ${legal}`;

  const footerExtra = `<br/><a href="${escapeHtml(unsubscribe)}" style="color:#8a8377;text-decoration:underline;">Se désinscrire de La Lettre Holiswiss</a>`;

  return { subject, html: emailShell(inner, footerExtra) };
}
