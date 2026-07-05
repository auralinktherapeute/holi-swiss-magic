import type { TemplateId } from "./custom-email-templates.shared";
export type { TemplateId } from "./custom-email-templates.shared";
export { TEMPLATE_OPTIONS } from "./custom-email-templates.shared";

const LOGO_URL =
  "https://holiswiss.ch/__l5e/assets-v1/b34e4e20-5d40-4759-bd7c-aefb0fa59668/lotus-logo.png";
const SITE_URL = "https://holiswiss.ch";

export type WaitlistVars = {
  first_name?: string | null;
  last_name?: string | null;
  specialty?: string | null;
  email: string;
  created_at?: string | null;
};

/** Contenu éditable d'un template : objet, corps markdown, libellé du bouton. */
export type TemplateContent = {
  subject: string;
  body: string;
  cta_label: string;
};

export type TemplateOverrides = Partial<Record<TemplateId, Partial<TemplateContent>>>;

/**
 * Défauts des templates — source unique de vérité.
 * Corps en markdown (gras **…**, listes "- ", liens [l](url)) avec variables
 * {{PRENOM}} {{NOM}} {{SPECIALITE}} {{EMAIL}} {{DATE_INSCRIPTION}}.
 * Le rendu passe toujours par le shell premium (logo, gradient, CTA, footer).
 */
export const TEMPLATE_DEFAULTS: Record<TemplateId, TemplateContent> = {
  invitation: {
    subject: "Votre place sur HoliSwiss est prête",
    body: `Bonjour {{PRENOM}},

Vous vous êtes inscrit(e) sur notre liste d'attente en tant que thérapeute **{{SPECIALITE}}**.

Bonne nouvelle : votre place est maintenant prête.

**Accès Fondateur — 100 % gratuit jusqu'au lancement**
- Visibilité immédiate auprès des patients suisses
- Gestion des réservations en ligne
- Page profil personnalisée
- Badge exclusif « Thérapeute Fondateur »

Cette invitation est personnelle et valable 30 jours.`,
    cta_label: "Créer mon profil gratuitement",
  },
  welcome: {
    subject: "Bienvenue dans la communauté HoliSwiss",
    body: `Bonjour {{PRENOM}},

Nous sommes ravis de vous compter parmi les thérapeutes HoliSwiss.

Voici les prochaines étapes pour créer votre profil :
- Ajoutez votre photo professionnelle
- Décrivez votre approche et vos spécialités
- Définissez vos tarifs et disponibilités
- Publiez votre profil pour être visible`,
    cta_label: "Accéder à mon espace thérapeute",
  },
  profile_live: {
    subject: "Votre profil HoliSwiss est maintenant visible",
    body: `Bonjour {{PRENOM}},

Félicitations ! Votre profil est désormais en ligne et visible par tous les patients en Suisse.

Quelques conseils pour optimiser votre visibilité :
- Une photo claire augmente les contacts de 70 %
- Décrivez votre approche en quelques phrases
- Mettez à jour vos disponibilités chaque semaine`,
    cta_label: "Voir mon profil",
  },
  reminder_complete: {
    subject: "Quelques minutes pour compléter votre profil",
    body: `Bonjour {{PRENOM}},

Votre profil HoliSwiss est presque prêt — il ne manque que quelques éléments pour qu'il soit publié.

Ce qui reste à compléter :
- Photo de profil
- Description de votre pratique
- Vos disponibilités

Cela prend moins de 5 minutes et vous permet d'être trouvé(e) par les patients.`,
    cta_label: "Compléter mon profil",
  },
  official_launch: {
    subject: "HoliSwiss est officiellement lancé",
    body: `Bonjour {{PRENOM}},

Ça y est — **HoliSwiss est officiellement lancé en Suisse** !

En tant que membre des premiers inscrits, vous bénéficiez à vie du badge exclusif **Thérapeute Fondateur** sur votre profil.

Aidez-nous à faire connaître HoliSwiss en partageant votre profil à vos patients et confrères.`,
    cta_label: "Voir mon profil en ligne",
  },
  custom: {
    subject: "Un message de HoliSwiss",
    body: `Bonjour {{PRENOM}},
`,
    cta_label: "",
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}.${mm}.${d.getFullYear()}`;
  } catch {
    return "";
  }
}

function injectVars(text: string, vars: WaitlistVars): string {
  const prenom = vars.first_name?.trim() || "";
  const nom = vars.last_name?.trim() || "";
  return text
    .replace(/\{\{PRENOM\}\}/g, prenom || "Cher(e) thérapeute")
    .replace(/\{\{NOM\}\}/g, nom)
    .replace(/\{\{SPECIALITE\}\}/g, vars.specialty || "holistique")
    .replace(/\{\{EMAIL\}\}/g, vars.email)
    .replace(/\{\{DATE_INSCRIPTION\}\}/g, fmtDate(vars.created_at));
}

function header(): string {
  return `<tr><td style="background:linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%);padding:36px 24px 28px;text-align:center;">
    <img src="${LOGO_URL}" alt="HoliSwiss" width="80" height="80" style="display:block;margin:0 auto 14px;width:80px;height:80px;">
    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">HoliSwiss</h1>
    <p style="margin:6px 0 0;color:#ddd6fe;font-size:13px;">La référence suisse des thérapies holistiques</p>
  </td></tr>`;
}

function footer(): string {
  return `<tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:22px;text-align:center;color:#6b7280;font-size:12px;line-height:1.7;">
    <div style="margin-bottom:8px;color:#374151;">Avec bienveillance,<br><strong>L'équipe HoliSwiss</strong></div>
    <div><a href="mailto:contact@holiswiss.ch" style="color:#7C3AED;text-decoration:none;">contact@holiswiss.ch</a> · <a href="${SITE_URL}" style="color:#7C3AED;text-decoration:none;">holiswiss.ch</a></div>
    <div style="margin-top:10px;color:#9ca3af;">© 2026 HoliSwiss · Suisse</div>
  </td></tr>`;
}

function cta(href: string, label: string): string {
  return `<p style="text-align:center;margin:28px 0;">
    <a href="${href}" style="display:inline-block;padding:16px 44px;border-radius:50px;background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#ffffff;font-weight:700;font-size:16px;text-decoration:none;box-shadow:0 4px 16px rgba(124,58,237,0.40);">${escapeHtml(label)}</a>
  </p>`;
}

function shell(subject: string, inner: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        ${header()}
        <tr><td style="padding:32px 28px;color:#1f2937;font-size:15px;line-height:1.7;">
          ${inner}
        </td></tr>
        ${footer()}
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Markdown minimal → HTML sûr (gras, listes, liens, paragraphes, ## titres). */
function mdToHtml(src: string): string {
  const escaped = escapeHtml(src);
  let out = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, l, u) =>
    `<a href="${u}" style="color:#7C3AED;text-decoration:underline;">${l}</a>`);
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  const lines = out.split(/\n/);
  const blocks: string[] = [];
  let buf: string[] = [];
  let inList = false;
  const flushPara = () => {
    if (!buf.length) return;
    blocks.push(`<p style="margin:0 0 14px;">${buf.join("<br>")}</p>`);
    buf = [];
  };
  for (const ln of lines) {
    if (/^##\s+/.test(ln)) {
      if (inList) { blocks.push("</ul>"); inList = false; }
      flushPara();
      blocks.push(`<h2 style="margin:22px 0 12px;color:#111827;font-size:18px;font-weight:600;">${ln.replace(/^##\s+/, "")}</h2>`);
    } else if (/^\s*-\s+/.test(ln)) {
      if (!inList) { flushPara(); blocks.push("<ul style=\"margin:0 0 14px;padding-left:20px;\">"); inList = true; }
      blocks.push(`<li style="margin:4px 0;">${ln.replace(/^\s*-\s+/, "")}</li>`);
    } else if (ln.trim() === "") {
      if (inList) { blocks.push("</ul>"); inList = false; }
      flushPara();
    } else {
      if (inList) { blocks.push("</ul>"); inList = false; }
      buf.push(ln);
    }
  }
  if (inList) blocks.push("</ul>");
  flushPara();
  return blocks.join("\n");
}

/** URL du bouton selon le template (logique métier non éditable). */
function ctaHref(templateId: TemplateId, args: { therapistSlug?: string | null; invitationLink?: string }): string | null {
  switch (templateId) {
    case "invitation":
      return args.invitationLink || `${SITE_URL}/creer-profil`;
    case "welcome":
    case "official_launch":
      return `${SITE_URL}/dashboard`;
    case "profile_live":
      return args.therapistSlug ? `${SITE_URL}/fr/therapeute/${args.therapistSlug}` : `${SITE_URL}/fr/therapeutes`;
    case "reminder_complete":
      return `${SITE_URL}/dashboard/profil`;
    case "custom":
      return null;
  }
}

/** Fusionne défaut + override éventuel. */
export function resolveTemplateContent(
  templateId: TemplateId,
  overrides?: TemplateOverrides,
): TemplateContent {
  const base = TEMPLATE_DEFAULTS[templateId];
  const o = overrides?.[templateId];
  return {
    subject: (o?.subject ?? base.subject).trim() || base.subject,
    body: o?.body ?? base.body,
    cta_label: o?.cta_label ?? base.cta_label,
  };
}

export function buildEmail(args: {
  templateId: TemplateId;
  vars: WaitlistVars;
  customSubject?: string;
  customMessage?: string;
  therapistSlug?: string | null;
  invitationLink?: string;
  overrides?: TemplateOverrides;
}): { subject: string; html: string } {
  const content = resolveTemplateContent(args.templateId, args.overrides);

  // Le template « custom » garde son comportement historique : objet/message saisis à l'envoi.
  const rawSubject =
    args.templateId === "custom" && args.customSubject?.trim()
      ? args.customSubject.trim()
      : content.subject;
  const rawBody =
    args.templateId === "custom" && args.customMessage?.trim()
      ? `Bonjour {{PRENOM}},\n\n${args.customMessage.trim()}`
      : content.body;

  const subject = injectVars(rawSubject, args.vars);
  const bodyHtml = mdToHtml(injectVars(rawBody, args.vars));
  const href = ctaHref(args.templateId, args);
  const inner = href && content.cta_label ? `${bodyHtml}\n${cta(href, content.cta_label)}` : bodyHtml;
  return { subject, html: shell(subject, inner) };
}

export function applyVars(html: string, vars: WaitlistVars): string {
  return injectVars(html, vars);
}
