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
  preferencesUrl?: string | null;
};

function paragraphs(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .split(/\n{2,}/)
    .map((block) => {
      // « Titre :: description » devient une carte « nouveauté ».
      const m = block.match(/^([^\n:]{2,80})\s*::\s*([\s\S]+)$/);
      if (m) {
        return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border-collapse:separate;">
      <tr><td style="background:#f6f4ef;border-left:3px solid #6B7B5E;border-radius:6px;padding:14px 16px;">
        <div style="margin:0 0 4px;color:#1c1c1e;font-size:15px;font-weight:700;line-height:1.4;">${escapeHtml(m[1].trim())}</div>
        <div style="margin:0;color:#4a463f;font-size:14px;line-height:1.6;">${escapeHtml(m[2].trim()).replace(/\n/g, "<br/>")}</div>
      </td></tr></table>`;
      }
      return `<p style="margin:0 0 14px;">${escapeHtml(block).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
}

/** Construit l'email complet (objet + HTML) d'une newsletter. */
export function renderNewsletterEmail(input: NewsletterEmailInput): {
  subject: string;
  html: string;
} {
  const subject = input.subject?.trim() || "La Lettre Holiswiss";
  const unsubscribe = input.unsubscribeUrl || "https://holiswiss.ch/desinscription";
  const preferences = input.preferencesUrl || "https://holiswiss.ch/dashboard/profil";

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

  // Mentions légales obligatoires : raison de réception, préférences, désinscription,
  // confidentialité et contact valide. Uniquement marketing — les emails de compte,
  // de rendez-vous et de sécurité ne sont pas concernés.
  const linkStyle = "color:#6B7B5E;text-decoration:underline;";
  const footerExtra = `
    <div style="margin-top:12px;color:#8a8377;font-size:12px;line-height:1.7;">
      Vous recevez La Lettre Holiswiss parce que vous êtes thérapeute inscrit·e sur Holiswiss
      et que vous avez accepté de recevoir nos informations professionnelles.
      <br/>
      <a href="${escapeHtml(preferences)}" style="${linkStyle}">Gérer mes préférences</a>
      &nbsp;·&nbsp;
      <a href="${escapeHtml(unsubscribe)}" style="${linkStyle}">Se désinscrire</a>
      &nbsp;·&nbsp;
      <a href="https://holiswiss.ch/fr/confidentialite" style="${linkStyle}">Politique de confidentialité</a>
      &nbsp;·&nbsp;
      <a href="mailto:contact@holiswiss.ch" style="${linkStyle}">contact@holiswiss.ch</a>
      <br/>
      HoliSwiss — Annuaire des thérapeutes en Suisse · contact@holiswiss.ch
      <br/>
      La désinscription est gratuite et immédiate ; elle n'affecte ni votre compte,
      ni les emails liés à vos rendez-vous et à la sécurité de votre profil.
    </div>`;

  return { subject, html: emailShell(inner, footerExtra) };
}

/** Version texte brut de l'email (contrôle avant envoi, clients sans HTML). */
export function renderNewsletterText(input: NewsletterEmailInput): string {
  const subject = input.subject?.trim() || "La Lettre Holiswiss";
  const unsubscribe = input.unsubscribeUrl || "https://holiswiss.ch/desinscription";
  const preferences = input.preferencesUrl || "https://holiswiss.ch/dashboard/profil";

  const plain = (text: string | null | undefined) =>
    (text ?? "")
      .split(/\n{2,}/)
      .map((block) => {
        const m = block.match(/^([^\n:]{2,80})\s*::\s*([\s\S]+)$/);
        return m ? `${m[1].trim().toUpperCase()}\n${m[2].trim()}` : block.trim();
      })
      .filter(Boolean)
      .join("\n\n");

  const lines: string[] = ["LA LETTRE HOLISWISS", "", subject];
  if (input.preheader) lines.push("", input.preheader.trim());
  const intro = plain(input.intro);
  if (intro) lines.push("", intro);
  const body = plain(input.body);
  if (body) lines.push("", body);
  if (input.buttonLabel && input.buttonUrl)
    lines.push("", `${input.buttonLabel.trim()} : ${input.buttonUrl.trim()}`);
  if (input.footer) lines.push("", input.footer.trim());
  lines.push(
    "",
    "—",
    "Vous recevez La Lettre Holiswiss parce que vous êtes thérapeute inscrit·e sur Holiswiss et que vous avez accepté de recevoir nos informations professionnelles.",
    `Gérer mes préférences : ${preferences}`,
    `Se désinscrire : ${unsubscribe}`,
    "Politique de confidentialité : https://holiswiss.ch/fr/confidentialite",
    "HoliSwiss — Annuaire des thérapeutes en Suisse · contact@holiswiss.ch",
  );
  return lines.join("\n");
}
