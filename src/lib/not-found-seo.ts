/** Assainit le HTML d'une vraie 404 (voir src/server.ts). */
export function sanitizeNotFoundHtml(html: string): string {
  let out = html
    .replace(/<link[^>]*rel="(?:canonical|alternate)"[^>]*\/?>/gi, "")
    .replace(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<meta[^>]*name="robots"[^>]*\/?>/gi, "")
    .replace(/<meta[^>]*property="og:url"[^>]*\/?>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>Page introuvable — Holiswiss</title>");
  out = out.replace(/<head([^>]*)>/i, '<head$1><meta name="robots" content="noindex,follow"/>');
  return out;
}

