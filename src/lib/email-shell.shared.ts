// Gabarit HTML commun des emails HoliSwiss (extrait de holiswiss-email.server.ts
// pour être réutilisable côté prévisualisation admin). Aucun changement visuel.

export const EMAIL_LOGO_URL =
  "https://holiswiss.ch/__l5e/assets-v1/9ed4a73c-cb78-460c-aa00-d6966417b47d/lotus-transparent.png";

export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] as string));
}

export function emailShell(inner: string, footerExtra = ""): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background:#f5f2ef;"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e6ded4;">
    <tr><td style="padding:24px 24px 8px;text-align:center;">
      <img src="${EMAIL_LOGO_URL}" alt="HoliSwiss" width="72" style="display:block;margin:0 auto 8px;height:auto;">
      <div style="color:#7c3aed;font-size:12px;letter-spacing:2px;text-transform:uppercase;">HoliSwiss</div>
    </td></tr>
    <tr><td style="padding:24px 28px 32px;color:#333;font-size:15px;line-height:1.65;">${inner}</td></tr>
    <tr><td style="background:#faf7f2;padding:16px;text-align:center;color:#8a8377;font-size:12px;">© 2026 HoliSwiss · <a href="https://holiswiss.ch" style="color:#7c3aed;text-decoration:none;">holiswiss.ch</a>${footerExtra}</td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
