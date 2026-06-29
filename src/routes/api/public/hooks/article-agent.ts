import { createFileRoute } from "@tanstack/react-router";

const ADMIN_EMAIL = "contact@holiswiss.ch";
const DEFAULT_STATUS = "pending_validation";
const MAX_ARTICLES_PER_REQUEST = 10;

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
}

function cleanString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function resolveCategory(input: Record<string, unknown>, title: string): string {
  const explicit = cleanString(input.category || input.category_slug || input.main_category);
  if (explicit) return toSlug(explicit);

  const haystack = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const pairs: Array<[string, string[]]> = [
    ["chromotherapie", ["chromotherapie", "luminotherapie", "couleur", "couleurs"]],
    ["magnetisme", ["magnetiseur", "magnetisme", "soins energetiques"]],
    ["lithotherapie", ["lithotherapie", "cristaux", "cristal", "pierres"]],
    ["ayurveda", ["ayurveda", "ayurvedique"]],
    ["coaching", ["coach", "coaching"]],
    ["shiatsu", ["shiatsu"]],
    ["hypnose", ["hypnose"]],
    ["massage-bien-etre", ["massage"]],
    ["naturopathie", ["naturopathe", "naturopathie"]],
    ["sophrologie", ["sophrologie"]],
    ["acupuncture", ["acupuncture"]],
    ["meditation", ["meditation"]],
  ];
  return pairs.find(([, needles]) => needles.some((needle) => haystack.includes(needle)))?.[0] ?? "bien-etre";
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => cleanString(tag))
    .filter(Boolean)
    .map(toSlug)
    .slice(0, 12);
}

function buildFallbackBody(title: string, sourceRun?: string): string {
  const origin = sourceRun ? ` du ${sourceRun}` : "";
  return `## ${title}\n\nArticle reçu automatiquement depuis l'Agent Articles GEO/SEO HoliSwiss${origin}.\n\nCe contenu est placé en attente de validation afin que l'administrateur puisse le relire, l'enrichir, vérifier le vocabulaire et publier uniquement après contrôle éditorial.\n\n## Points à vérifier avant publication\n\n- Ajouter une introduction complète et localisée pour la Suisse.\n- Vérifier la conformité du vocabulaire : privilégier accompagnement, bien-être, équilibre et détente.\n- Éviter toute promesse médicale, diagnostic, guérison ou traitement.\n- Ajouter les liens internes vers les thérapeutes et catégories HoliSwiss pertinentes.\n\n> Article importé automatiquement — à compléter avant publication.`;
}

function normalizeArticle(input: Record<string, unknown>, sourceRun?: string) {
  const title = cleanString(input.title_fr || input.title || input.name);
  if (!title) throw new Error("Chaque article doit contenir title_fr ou title.");

  const slug = toSlug(cleanString(input.slug) || title);
  const excerpt = cleanString(input.excerpt_fr || input.excerpt || input.summary).slice(0, 500);
  const body = cleanString(input.body_fr || input.body || input.markdown || input.content) || buildFallbackBody(title, sourceRun);
  const category = resolveCategory(input, title);
  const status = cleanString(input.status) || DEFAULT_STATUS;

  return {
    slug,
    status: status === "validated" ? DEFAULT_STATUS : status,
    lang: cleanString(input.lang, "fr") || "fr",
    category,
    title_fr: title,
    excerpt_fr: excerpt || title,
    body_fr: body,
    meta_title_fr: cleanString(input.meta_title_fr || input.meta_title) || title.slice(0, 70),
    meta_description_fr:
      cleanString(input.meta_description_fr || input.meta_description || input.seo_description).slice(0, 180) ||
      (excerpt || `Article HoliSwiss en attente de validation : ${title}`).slice(0, 180),
    cover_image_url: cleanString(input.cover_image_url || input.image_url) || null,
    secondary_tags: normalizeTags(input.secondary_tags || input.tags),
  };
}

function isAuthorized(request: Request): boolean {
  const providedSecret = request.headers.get("x-agent-secret") || request.headers.get("x-holiswiss-agent-secret");
  const expectedSecret = process.env.SEO_ARTICLE_AGENT_SECRET;
  return !!expectedSecret && providedSecret === expectedSecret;
}

export const Route = createFileRoute("/api/public/hooks/article-agent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorized(request)) {
          return json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        let payload: any;
        try {
          payload = await request.json();
        } catch {
          return json({ ok: false, error: "JSON invalide." }, { status: 400 });
        }

        const rawArticles = Array.isArray(payload?.articles)
          ? payload.articles
          : Array.isArray(payload)
            ? payload
            : payload?.title || payload?.title_fr
              ? [payload]
              : [];

        if (!rawArticles.length) {
          return json({ ok: false, error: "Aucun article reçu. Envoyer { articles: [...] }." }, { status: 400 });
        }
        if (rawArticles.length > MAX_ARTICLES_PER_REQUEST) {
          return json({ ok: false, error: `Maximum ${MAX_ARTICLES_PER_REQUEST} articles par appel.` }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: adminUser } = await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 200 });
        const authorId = adminUser?.users?.find((u: any) => String(u.email ?? "").toLowerCase() === ADMIN_EMAIL)?.id ?? null;
        const sourceRun = cleanString(payload?.run_date || payload?.runDate || payload?.report_date || payload?.reportDate);

        const rows = rawArticles.map((item: unknown) => {
          if (!item || typeof item !== "object") throw new Error("Format d'article invalide.");
          return {
            ...normalizeArticle(item as Record<string, unknown>, sourceRun),
            author_id: authorId,
            published_at: null,
            updated_at: new Date().toISOString(),
          };
        });

        const { data: inserted, error } = await (supabaseAdmin as any)
          .from("articles")
          .upsert(rows, { onConflict: "slug" })
          .select("id,slug,status,title_fr,category,created_at");

        if (error) {
          console.error("[article-agent] insert failed", error);
          return json({ ok: false, error: error.message }, { status: 500 });
        }

        return json({
          ok: true,
          destination: {
            project_id: process.env.SUPABASE_PROJECT_ID || "qqwudmnfavvaukuldulr",
            table: "public.articles",
            admin_path: "/admin/articles?status=pending_validation",
            status: DEFAULT_STATUS,
          },
          inserted_count: inserted?.length ?? 0,
          articles: inserted ?? [],
        });
      },
    },
  },
});