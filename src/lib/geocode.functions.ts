import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const geocodeCity = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => {
    const q = String(data?.query ?? "").trim();
    if (!q || q.length > 120) throw new Error("Invalid query");
    return { query: q };
  })
  .handler(async ({ data }) => {
    // 1. Try the canonical Swiss cities table first (deterministic, alias-aware).
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (supabaseUrl && supabaseKey) {
      try {
        const sb = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: rows } = await sb.rpc("resolve_city", {
          _input: normalize(data.query),
        });
        const row = Array.isArray(rows) ? rows[0] : null;
        if (row?.lat != null && row?.lng != null) {
          return {
            ok: true as const,
            lat: row.lat as number,
            lng: row.lng as number,
            formatted: row.display_name as string,
          };
        }
      } catch {
        // fall through to Google
      }
    }

    // 2. Fallback to Google Maps via the connector gateway.
    const lovableKey = process.env.LOVABLE_API_KEY;
    const connKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !connKey) return { ok: false as const, reason: "no_key" };

    const url = new URL("https://connector-gateway.lovable.dev/google_maps/maps/api/geocode/json");
    url.searchParams.set("address", data.query);
    url.searchParams.set("components", "country:CH");
    url.searchParams.set("language", "fr");

    try {
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
        },
      });
      const json = (await res.json()) as {
        status: string;
        results?: Array<{
          formatted_address: string;
          geometry: { location: { lat: number; lng: number } };
        }>;
      };
      if (json.status !== "OK" || !json.results?.length) {
        return { ok: false as const, reason: "not_found" };
      }
      const r = json.results[0];
      return {
        ok: true as const,
        lat: r.geometry.location.lat,
        lng: r.geometry.location.lng,
        formatted: r.formatted_address,
      };
    } catch {
      return { ok: false as const, reason: "error" };
    }
  });