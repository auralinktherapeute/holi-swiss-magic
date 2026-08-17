import { createFileRoute } from "@tanstack/react-router";

/**
 * Désinscription « One-Click » RFC 8058 (List-Unsubscribe-Post).
 * Publique, sans connexion : le jeton UUID opaque identifie le thérapeute.
 * N'affecte que le marketing : le compte et les emails transactionnels sont intacts.
 */
async function unsubscribeByToken(token: string): Promise<boolean> {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(token)) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await supabaseAdmin
    .from("therapists")
    .select("id")
    .eq("newsletter_unsubscribe_token", token)
    .maybeSingle();
  if (!row) return false;
  await supabaseAdmin
    .from("therapists")
    .update({
      newsletter_opt_in: false,
      newsletter_unsubscribed_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  return true;
}

async function extractToken(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("token");
  if (fromQuery) return fromQuery;
  try {
    const raw = await request.text();
    if (!raw) return "";
    if (raw.trim().startsWith("{")) return String((JSON.parse(raw) as { token?: string }).token ?? "");
    return new URLSearchParams(raw).get("token") ?? "";
  } catch {
    return "";
  }
}

export const Route = createFileRoute("/api/public/newsletter/unsubscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = await extractToken(request);
        const ok = await unsubscribeByToken(token);
        // Les clients email one-click attendent un 200 même en cas de jeton inconnu.
        return new Response(JSON.stringify({ ok }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        await unsubscribeByToken(token);
        return new Response(null, {
          status: 302,
          headers: { location: `/desinscription?token=${encodeURIComponent(token)}` },
        });
      },
    },
  },
});
