import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://holiswiss.ch";
const LANGS = ["fr", "de", "it", "en"] as const;

const STATIC_PATHS: { path: string; priority: string; changefreq: string }[] = [
  { path: "", priority: "1.0", changefreq: "weekly" },
  { path: "/therapeutes", priority: "0.9", changefreq: "daily" },
  { path: "/blog", priority: "0.8", changefreq: "weekly" },
  { path: "/evenements", priority: "0.8", changefreq: "daily" },
  { path: "/tarifs", priority: "0.7", changefreq: "monthly" },
  { path: "/contact", priority: "0.5", changefreq: "yearly" },
  { path: "/impressum", priority: "0.3", changefreq: "yearly" },
  { path: "/conditions", priority: "0.3", changefreq: "yearly" },
  { path: "/confidentialite", priority: "0.3", changefreq: "yearly" },
];

function xmlEscape(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlBlock(loc: string, lastmod?: string, changefreq?: string, priority?: string) {
  return [
    "  <url>",
    `    <loc>${xmlEscape(loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls: string[] = [];

        // Static pages × langues
        for (const lang of LANGS) {
          for (const p of STATIC_PATHS) {
            urls.push(urlBlock(`${BASE_URL}/${lang}${p.path}`, undefined, p.changefreq, p.priority));
          }
        }

        // Dynamic: therapists (active) + events (published, future) — Holiswiss main DB
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: therapists } = await supabaseAdmin
            .from("therapists")
            .select("slug, updated_at")
            .eq("status", "active")
            .not("slug", "is", null);

          for (const t of (therapists ?? []) as Array<{ slug: string | null; updated_at: string | null }>) {
            if (!t.slug) continue;
            const lastmod = t.updated_at ? t.updated_at.slice(0, 10) : undefined;
            for (const lang of LANGS) {
              urls.push(urlBlock(`${BASE_URL}/${lang}/therapeute/${t.slug}`, lastmod, "weekly", "0.8"));
            }
          }

          const today = new Date().toISOString().slice(0, 10);
          const { data: events } = await supabaseAdmin
            .from("events")
            .select("id, updated_at")
            .eq("status", "published")
            .gte("event_date", today);

          for (const e of (events ?? []) as Array<{ id: string; updated_at: string | null }>) {
            const lastmod = e.updated_at ? e.updated_at.slice(0, 10) : undefined;
            for (const lang of LANGS) {
              urls.push(urlBlock(`${BASE_URL}/${lang}/evenements/${e.id}`, lastmod, "weekly", "0.7"));
            }
          }
        } catch (err) {
          console.error("sitemap: therapists/events fetch failed", err);
        }

        // Dynamic: blog articles — separate Holiswiss CMS project
        try {
          const { holiswissPublic } = await import("@/integrations/supabase/holiswiss-public");
          const { data: articles } = await (holiswissPublic as any)
            .from("articles")
            .select("slug, published_at, updated_at")
            .eq("status", "validated");

          for (const a of (articles ?? []) as Array<{ slug: string; published_at: string | null; updated_at: string | null }>) {
            if (!a.slug) continue;
            const lastmod = (a.updated_at || a.published_at)?.slice(0, 10);
            for (const lang of LANGS) {
              urls.push(urlBlock(`${BASE_URL}/${lang}/blog/${a.slug}`, lastmod, "monthly", "0.7"));
            }
          }
        } catch (err) {
          console.error("sitemap: articles fetch failed", err);
        }

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});