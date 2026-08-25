import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { resolveProfileLang } from "@/lib/seo";
import { cityToSlug } from "@/lib/city-slug";

const BASE_URL = "https://holiswiss.ch";
const LANGS = ["fr", "de", "it", "en"] as const;

const STATIC_PATHS: { path: string; priority: string; changefreq: string }[] = [
  { path: "", priority: "1.0", changefreq: "weekly" },
  { path: "/therapeutes", priority: "0.9", changefreq: "daily" },
  { path: "/blog", priority: "0.8", changefreq: "weekly" },
  { path: "/paroles", priority: "0.8", changefreq: "weekly" },
  { path: "/evenements", priority: "0.8", changefreq: "daily" },
  { path: "/tarifs", priority: "0.7", changefreq: "monthly" },
  { path: "/faq", priority: "0.6", changefreq: "monthly" },
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

          // Specialty families (indexable)
          const { data: families } = await supabaseAdmin
            .from("specialty_families")
            .select("slug, updated_at");
          for (const f of (families ?? []) as Array<{ slug: string; updated_at: string | null }>) {
            const lastmod = f.updated_at ? f.updated_at.slice(0, 10) : undefined;
            for (const lang of LANGS) {
              urls.push(urlBlock(`${BASE_URL}/${lang}/therapeutes/famille/${f.slug}`, lastmod, "weekly", "0.8"));
            }
          }

          // Active specialties (indexable). slug_de peut ne pas encore exister
          // côté base : on replie sur les colonnes de base plutôt que de perdre
          // silencieusement les ~200 URL de spécialités du sitemap.
          // `slug_de` n'est pas encore dans les types générés → cast local.
          let { data: specs, error: specsErr } = await (supabaseAdmin as any)
            .from("specialties")
            .select("slug, slug_de, updated_at")
            .eq("is_active", true);
          if (specsErr) {
            ({ data: specs } = await (supabaseAdmin as any)
              .from("specialties")
              .select("slug, updated_at")
              .eq("is_active", true));
          }
          for (const s of (specs ?? []) as Array<{ slug: string; slug_de?: string | null; updated_at: string | null }>) {
            const lastmod = s.updated_at ? s.updated_at.slice(0, 10) : undefined;
            for (const lang of LANGS) {
              const slug = lang === "de" ? (s.slug_de || s.slug) : s.slug;
              urls.push(urlBlock(`${BASE_URL}/${lang}/specialites/${slug}`, lastmod, "weekly", "0.7"));
            }
          }

          // GEO combos: specialty × city, only when at least one active therapist exists
          try {
            let { data: geoPairs, error: geoErr } = await supabaseAdmin
              .from("therapist_specialties")
              .select("specialties!inner(slug,slug_de,is_active), therapists!inner(city,status)");
            if (geoErr) {
              ({ data: geoPairs } = await supabaseAdmin
                .from("therapist_specialties")
                .select("specialties!inner(slug,is_active), therapists!inner(city,status)"));
            }
            const seen = new Set<string>();
            for (const row of (geoPairs ?? []) as any[]) {
              const specSlug = row.specialties?.slug;
              const specSlugDe = row.specialties?.slug_de;
              const isActive = row.specialties?.is_active;
              const city = row.therapists?.city;
              const status = row.therapists?.status;
              if (!specSlug || !isActive || !city || status !== "active") continue;
              const cSlug = cityToSlug(city);
              if (!cSlug) continue;
              const key = `${specSlug}::${cSlug}`;
              if (seen.has(key)) continue;
              seen.add(key);
              for (const lang of LANGS) {
                const slug = lang === "de" ? (specSlugDe || specSlug) : specSlug;
                urls.push(urlBlock(`${BASE_URL}/${lang}/specialites/${slug}/${cSlug}`, undefined, "weekly", "0.6"));
              }
            }
          } catch (err) {
            console.error("sitemap: geo combos failed", err);
          }

          // Une SEULE URL par fiche, dans sa langue de rédaction.
          //
          // La table `therapists` n'a pas de colonnes de traduction : publier les
          // quatre langues revenait à déclarer quatre URL pour un unique texte
          // français. Google l'avait déjà compris et consolidait vers la version
          // francophone (`canonical_other` sur les variantes DE/EN/IT). La langue
          // retenue suit le canton, puis les langues parlées — même règle que le
          // canonical de la fiche, qu'il ne faut pas laisser diverger.
          const { data: therapists } = await supabaseAdmin
            .from("therapists")
            .select("slug, updated_at, canton, languages")
            .eq("status", "active")
            .not("slug", "is", null);

          for (const t of (therapists ?? []) as Array<{
            slug: string | null;
            updated_at: string | null;
            canton: string | null;
            languages: string[] | null;
          }>) {
            if (!t.slug) continue;
            const lastmod = t.updated_at ? t.updated_at.slice(0, 10) : undefined;
            const lang = resolveProfileLang(null, t.canton, t.languages);
            urls.push(urlBlock(`${BASE_URL}/${lang}/therapeute/${t.slug}`, lastmod, "weekly", "0.8"));
          }

          // Listings géographiques indexables : canton et ville. Uniquement
          // ceux qui comptent au moins une fiche active (pas de page vide).
          {
            const { data: geoRows } = await supabaseAdmin
              .from("therapists")
              .select("canton, city")
              .eq("status", "active");
            const cantons = new Set<string>();
            const cities = new Set<string>();
            const toSlug = (c: string) =>
              c
                .toLowerCase()
                .normalize("NFD")
                .replace(/\p{Diacritic}/gu, "")
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
            for (const r of (geoRows ?? []) as Array<{ canton: string | null; city: string | null }>) {
              const code = (r.canton ?? "").trim().toUpperCase();
              if (code.length === 2) cantons.add(code);
              const cSlug = toSlug((r.city ?? "").trim());
              if (cSlug) cities.add(cSlug);
            }
            for (const code of cantons) {
              for (const lang of LANGS) {
                urls.push(urlBlock(`${BASE_URL}/${lang}/therapeutes/canton/${code}`, undefined, "weekly", "0.7"));
              }
            }
            for (const cSlug of cities) {
              for (const lang of LANGS) {
                urls.push(urlBlock(`${BASE_URL}/${lang}/therapeutes/ville/${cSlug}`, undefined, "weekly", "0.7"));
              }
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
          // slug_de peut ne pas encore exister côté base (migration pas encore
          // appliquée) : on retombe sur le slug de base plutôt que de perdre
          // silencieusement les 150+ URL du blog du sitemap.
          let { data: articles, error } = await (holiswissPublic as any)
            .from("articles")
            .select("slug, slug_de, published_at, updated_at")
            .eq("status", "validated");
          if (error) {
            ({ data: articles, error } = await (holiswissPublic as any)
              .from("articles")
              .select("slug, published_at, updated_at")
              .eq("status", "validated"));
            if (error) throw error;
          }

          for (const a of (articles ?? []) as Array<{ slug: string; slug_de?: string | null; published_at: string | null; updated_at: string | null }>) {
            if (!a.slug) continue;
            const lastmod = (a.updated_at || a.published_at)?.slice(0, 10);
            for (const lang of LANGS) {
              const slug = lang === "de" ? (a.slug_de || a.slug) : a.slug;
              urls.push(urlBlock(`${BASE_URL}/${lang}/blog/${slug}`, lastmod, "monthly", "0.7"));
            }
          }
        } catch (err) {
          console.error("sitemap: articles fetch failed", err);
        }

        // Dynamic: therapist articles ("Voix d'experts") — /paroles/$slug
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: parolesArticles } = await supabaseAdmin
            .from("therapist_articles")
            .select("slug, updated_at, date_publication")
            .eq("statut", "publie");
          for (const a of (parolesArticles ?? []) as Array<{ slug: string | null; updated_at: string | null; date_publication: string | null }>) {
            if (!a.slug) continue;
            const lastmod = (a.updated_at || a.date_publication)?.slice(0, 10);
            for (const lang of LANGS) {
              urls.push(urlBlock(`${BASE_URL}/${lang}/paroles/${a.slug}`, lastmod, "monthly", "0.7"));
            }
          }
        } catch (err) {
          console.error("sitemap: paroles fetch failed", err);
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