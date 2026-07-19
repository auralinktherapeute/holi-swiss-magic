import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// CSP volontairement en Report-Only : elle ne bloque rien, elle journalise les
// violations dans la console du navigateur pour calibrer la liste des sources
// tierces (Supabase, Unsplash, Calendly, Stripe, Google Maps, Lovable…) avant
// une éventuelle activation bloquante. 'unsafe-inline'/'unsafe-eval' sont
// tolérés tant que l'hydratation React n'utilise pas de nonces.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://www.google.com https://unpkg.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.unsplash.com https://images.unsplash.com https://maps.googleapis.com https://*.lovable.dev https://api.qrserver.com https://*.r2.dev https://*.carto.com",
  "frame-src 'self' https://*.calendly.com https://buy.stripe.com https://www.google.com https://maps.googleapis.com",
  "form-action 'self' https://buy.stripe.com",
].join("; ");

// Durcissement des en-têtes appliqué à toute réponse dynamique (HTML SSR +
// routes serveur). Les assets statiques sont servis par le CDN et n'ont pas
// besoin de ces protections « document ».
function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  // Sûr sur toute réponse
  headers.set("X-Content-Type-Options", "nosniff");
  if (!headers.has("Strict-Transport-Security")) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()");
    if (!headers.has("Content-Security-Policy-Report-Only")) {
      headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
      );
    }
  },
};
