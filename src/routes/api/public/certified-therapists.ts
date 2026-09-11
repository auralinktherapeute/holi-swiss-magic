import { createFileRoute } from "@tanstack/react-router";

// Domaines autorisés à appeler cette route depuis un navigateur.
// Pas de wildcard : la liste est explicite.
const ALLOWED_ORIGINS = [
  "https://svhh.ch",
  "https://www.svhh.ch",
  "https://soulsense.ch",
  "https://www.soulsense.ch",
  "https://holiswiss.ch",
  "https://www.holiswiss.ch",
];

const ALLOWED_ORIGIN_SUFFIXES = [".svhh.ch", ".soulsense.ch", ".lovable.app"];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      ALLOWED_ORIGIN_SUFFIXES.some((s) => {
        try {
          return new URL(origin).hostname.endsWith(s);
        } catch {
          return false;
        }
      }));
  return allowed
    ? {
        "Access-Control-Allow-Origin": origin!,
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      }
    : { Vary: "Origin" };
}

// Limitation de débit best-effort, par instance : 60 requêtes / minute / IP.
const BUCKET = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 60;
const WINDOW_MS = 60_000;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = BUCKET.get(ip);
  if (!entry || entry.resetAt <= now) {
    BUCKET.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    if (BUCKET.size > 5000) {
      for (const [k, v] of BUCKET) if (v.resetAt <= now) BUCKET.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

function json(body: unknown, status: number, extra: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}

export const Route = createFileRoute("/api/public/certified-therapists")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) =>
        new Response(null, { status: 204, headers: corsHeaders(request.headers.get("origin")) }),

      GET: async ({ request }) => {
        const origin = request.headers.get("origin");
        const cors = corsHeaders(origin);

        const ip =
          request.headers.get("cf-connecting-ip") ||
          (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
          "unknown";
        if (rateLimited(ip)) {
          return json({ error: "rate_limited" }, 429, { ...cors, "Retry-After": "60" });
        }

        const url = new URL(request.url);
        const organizationCode = (url.searchParams.get("organization_code") ?? "").trim();
        const canton = (url.searchParams.get("canton") ?? "").trim();
        const method = (
          url.searchParams.get("method") ??
          url.searchParams.get("specialty") ??
          ""
        ).trim();
        const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
        const limit = Math.min(
          100,
          Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20),
        );

        const cacheHeaders = { "Cache-Control": "public, max-age=900, s-maxage=900" };

        if (!organizationCode) {
          return json({ error: "organization_code_required" }, 400, cors);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        const empty = {
          data: [],
          pagination: { page, limit, total: 0, total_pages: 0 },
        };

        // 1. Organisme : jamais d'erreur qui révèle son existence ou son état.
        const { data: org } = await admin
          .from("certification_organizations")
          .select("id,is_active")
          .eq("code", organizationCode)
          .maybeSingle();
        if (!org || org.is_active === false) {
          return json(empty, 200, { ...cors, ...cacheHeaders });
        }

        // 2. Thérapeutes certifiés actifs pour cet organisme.
        const { data: links, error: linkError } = await admin
          .from("therapist_org_certifications")
          .select("therapist_id,certified_since")
          .eq("organization_id", org.id)
          .eq("status", "active");
        if (linkError) return json({ error: "unavailable" }, 503, cors);

        const certifiedSince = new Map<string, string | null>();
        for (const l of (links ?? []) as Array<{ therapist_id: string; certified_since: string | null }>) {
          certifiedSince.set(l.therapist_id, l.certified_since);
        }
        let ids = [...certifiedSince.keys()];
        if (!ids.length) return json(empty, 200, { ...cors, ...cacheHeaders });

        // 3. Filtre optionnel par spécialité (slug ou nom).
        if (method) {
          const { data: specs } = await admin
            .from("specialties")
            .select("id")
            .or(
              [
                `slug.eq.${method}`,
                `slug_de.eq.${method}`,
                `slug_it.eq.${method}`,
                `slug_en.eq.${method}`,
                `name_fr.ilike.${method}`,
                `name_de.ilike.${method}`,
                `name_it.ilike.${method}`,
                `name_en.ilike.${method}`,
              ].join(","),
            );
          const specIds = ((specs ?? []) as Array<{ id: string }>).map((s) => s.id);
          if (!specIds.length) return json(empty, 200, { ...cors, ...cacheHeaders });
          const { data: ts } = await admin
            .from("therapist_specialties")
            .select("therapist_id")
            .in("therapist_id", ids)
            .in("specialty_id", specIds);
          const keep = new Set(((ts ?? []) as Array<{ therapist_id: string }>).map((r) => r.therapist_id));
          ids = ids.filter((id) => keep.has(id));
          if (!ids.length) return json(empty, 200, { ...cors, ...cacheHeaders });
        }

        // 4. Champs publics uniquement — aucune coordonnée, aucune référence interne.
        let query = admin
          .from("therapists")
          .select("id,slug,first_name,last_name,city,canton,photo_url,specialties", { count: "exact" })
          .in("id", ids)
          .eq("status", "active");
        if (canton) query = query.eq("canton", canton);

        const from = (page - 1) * limit;
        const { data: rows, count, error } = await query
          .order("last_name", { ascending: true })
          .range(from, from + limit - 1);
        if (error) return json({ error: "unavailable" }, 503, cors);

        const data = ((rows ?? []) as any[]).map((t) => ({
          id: t.id,
          display_name: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim(),
          specialties: Array.isArray(t.specialties) ? t.specialties : [],
          canton: t.canton ?? null,
          city: t.city ?? null,
          photo_url: t.photo_url ?? null,
          slug: t.slug,
          certified_since: certifiedSince.get(t.id) ?? null,
        }));

        const total = count ?? data.length;
        return json(
          {
            data,
            pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
          },
          200,
          { ...cors, ...cacheHeaders },
        );
      },
    },
  },
});
