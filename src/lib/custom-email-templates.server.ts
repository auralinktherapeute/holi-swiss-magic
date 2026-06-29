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

export type TemplateId =
  | "invitation"
  | "welcome"
  | "profile_live"
  | "reminder_complete"
  | "official_launch"
  | "custom";

export const TEMPLATE_OPTIONS: { id: TemplateId; label: string; needsCustom?: boolean }[] = [
  { id: "invitation", label: "Invitation à créer votre profil" },
  { id: "welcome", label: "Bienvenue sur HoliSwiss" },
  { id: "profile_live", label: "Votre profil est en ligne" },
  { id: "reminder_complete", label: "Rappel — Complétez votre profil" },
  { id: "official_launch", label: "Lancement officiel HoliSwiss" },
  { id: "custom", label: "Message personnalisé", needsCustom: true },
];

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
    .replace(/\{\{PRENOM\}\}/g, escapeHtml(prenom || "Cher(e) thérapeute"))
    .replace(/\{\{NOM\}\}/g, escapeHtml(nom))
    .replace(/\{\{SPECIALITE\}\}/g, escapeHtml(vars.specialty || "holistique"))
    .replace(/\{\{EMAIL\}\}/g, escapeHtml(vars.email))
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

/** Simple markdown → safe HTML (bold, lists, links, paragraphs) */
function mdToHtml(src: string): string {
  const escaped = escapeHtml(src);
  // links [label](url)
  let out = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, l, u) =>
    `<a href="${u}" style="color:#7C3AED;text-decoration:underline;">${l}</a>`);
  // bold **text**
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // simple list lines starting with "- "
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
    if (/^\s*-\s+/.test(ln)) {
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

export function buildEmail(args: {
  templateId: TemplateId;
  vars: WaitlistVars;
  customSubject?: string;
  customMessage?: string;
  therapistSlug?: string | null;
  invitationLink?: string;
}): { subject: string; html: string } {
  const v = args.vars;
  const prenom = v.first_name?.trim() || "Cher(e) thérapeute";
  const greeting = `<h2 style="margin:0 0 14px;color:#111827;font-size:20px;font-weight:600;">Bonjour ${escapeHtml(prenom)} 👋</h2>`;

  switch (args.templateId) {
    case "invitation": {
      const link = args.invitationLink || `${SITE_URL}/creer-profil`;
      const subject = "✨ Votre place sur HoliSwiss est prête";
      const body = `${greeting}
        <p style="margin:0 0 14px;">Vous vous êtes inscrit(e) sur notre liste d'attente en tant que thérapeute <strong>${escapeHtml(v.specialty || "holistique")}</strong>.</p>
        <p style="margin:0 0 22px;">Bonne nouvelle : votre place est maintenant prête. 🎉</p>
        <div style="background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:18px 20px;margin:0 0 22px;color:#4c1d95;font-size:14px;line-height:1.85;">
          <p style="margin:0 0 10px;color:#7C3AED;font-weight:700;">✨ Accès Fondateur — 100% gratuit jusqu'au lancement</p>
          🌐 Visibilité immédiate auprès des patients suisses<br>
          📅 Gestion des réservations en ligne<br>
          🎨 Page profil personnalisée<br>
          🏅 Badge exclusif "Thérapeute Fondateur"
        </div>
        ${cta(link, "👉 Créer mon profil gratuitement")}
        <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">Cette invitation est personnelle et valable 30 jours.</p>`;
      return { subject, html: shell(subject, body) };
    }
    case "welcome": {
      const subject = "Bienvenue dans la communauté HoliSwiss 🌿";
      const body = `${greeting}
        <p style="margin:0 0 14px;">Nous sommes ravis de vous compter parmi les thérapeutes HoliSwiss.</p>
        <p style="margin:0 0 14px;">Voici les prochaines étapes pour créer votre profil :</p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
          <li style="margin:6px 0;">Ajoutez votre photo professionnelle</li>
          <li style="margin:6px 0;">Décrivez votre approche et vos spécialités</li>
          <li style="margin:6px 0;">Définissez vos tarifs et disponibilités</li>
          <li style="margin:6px 0;">Publiez votre profil pour être visible</li>
        </ul>
        ${cta(`${SITE_URL}/dashboard`, "Accéder à mon espace thérapeute")}`;
      return { subject, html: shell(subject, body) };
    }
    case "profile_live": {
      const subject = "Votre profil HoliSwiss est maintenant visible 🎉";
      const profileUrl = args.therapistSlug
        ? `${SITE_URL}/fr/therapeute/${args.therapistSlug}`
        : `${SITE_URL}/fr/therapeutes`;
      const body = `${greeting}
        <p style="margin:0 0 14px;">Félicitations ! Votre profil est désormais en ligne et visible par tous les patients en Suisse.</p>
        <p style="margin:0 0 14px;">Quelques conseils pour optimiser votre visibilité :</p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
          <li style="margin:6px 0;">Une photo claire augmente les contacts de 70%</li>
          <li style="margin:6px 0;">Décrivez votre approche en quelques phrases</li>
          <li style="margin:6px 0;">Mettez à jour vos disponibilités chaque semaine</li>
        </ul>
        ${cta(profileUrl, "Voir mon profil")}`;
      return { subject, html: shell(subject, body) };
    }
    case "reminder_complete": {
      const subject = "Quelques minutes pour compléter votre profil 🌟";
      const body = `${greeting}
        <p style="margin:0 0 14px;">Votre profil HoliSwiss est presque prêt — il ne manque que quelques éléments pour qu'il soit publié.</p>
        <p style="margin:0 0 14px;">Ce qui reste à compléter :</p>
        <ul style="margin:0 0 20px;padding-left:20px;color:#374151;">
          <li style="margin:6px 0;">📷 Photo de profil</li>
          <li style="margin:6px 0;">📝 Description de votre pratique</li>
          <li style="margin:6px 0;">📅 Vos disponibilités</li>
        </ul>
        <p style="margin:0 0 22px;">Cela prend moins de 5 minutes et vous permet d'être trouvé(e) par les patients.</p>
        ${cta(`${SITE_URL}/dashboard/profil`, "Compléter mon profil")}`;
      return { subject, html: shell(subject, body) };
    }
    case "official_launch": {
      const subject = "🚀 HoliSwiss est officiellement lancé !";
      const body = `${greeting}
        <p style="margin:0 0 14px;">Ça y est — <strong>HoliSwiss est officiellement lancé en Suisse</strong> ! 🎉</p>
        <p style="margin:0 0 14px;">En tant que membre des premiers inscrits, vous bénéficiez à vie du badge exclusif <strong style="color:#7C3AED;">Thérapeute Fondateur</strong> sur votre profil.</p>
        <p style="margin:0 0 22px;">Aidez-nous à faire connaître HoliSwiss en partageant votre profil à vos patients et confrères.</p>
        ${cta(`${SITE_URL}/dashboard`, "Voir mon profil en ligne")}`;
      return { subject, html: shell(subject, body) };
    }
    case "custom": {
      const subject = args.customSubject?.trim() || "Un message de HoliSwiss";
      const message = args.customMessage?.trim() || "";
      const body = `${greeting}
        ${mdToHtml(message)}`;
      return { subject, html: shell(subject, body) };
    }
  }
}

export function applyVars(html: string, vars: WaitlistVars): string {
  return injectVars(html, vars);
}
