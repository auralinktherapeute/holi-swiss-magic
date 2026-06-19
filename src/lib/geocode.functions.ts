import { createServerFn } from "@tanstack/react-start";

export const geocodeCity = createServerFn({ method: "POST" })
  .inputValidator((data: { query: string }) => {
    const q = String(data?.query ?? "").trim();
    if (!q || q.length > 120) throw new Error("Invalid query");
    return { query: q };
  })
  .handler(async ({ data }) => {
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