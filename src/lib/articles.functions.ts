import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

type Lang = "fr" | "de" | "it" | "en";

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Helpers pour récupérer le champ localisé selon la langue
export function titleForLang(a: Record<string, unknown>, lang: Lang): string {
  return (a[`title_${lang}`] as string) || (a["title_fr"] as string) || "";
}
export function bodyForLang(a: Record<string, unknown>, lang: Lang): string {
  return (a[`body_${lang}`] as string) || (a["body_fr"] as string) || "";
}
export function excerptForLang(a: Record<string, unknown>, lang: Lang): string {
  return (a[`excerpt_${lang}`] as string) || (a["excerpt_fr"] as string) || "";
}
/**
 * Slug localisé pour une langue donnée. Seul `slug_de` existe à ce jour (les
 * autres langues restent sur le slug de base) — un article non encore localisé,
 * ou si la colonne n'existe pas encore côté base, retombe silencieusement sur
 * `slug`, sans régression.
 */
export function slugForLang(a: Record<string, unknown>, lang: Lang): string {
  return (a[`slug_${lang}`] as string) || (a["slug"] as string) || "";
}

/**
 * `slug_de` peut ne pas encore exister côté base (migration pas encore
 * appliquée) : on détecte spécifiquement l'erreur de colonne manquante pour
 * retomber sur les colonnes de base, plutôt que de casser tout le blog.
 */
function isMissingColumn(error: any): boolean {
  const code = error?.code ?? "";
  const msg = String(error?.message ?? "");
  return code === "42703" || code === "PGRST204" || code === "PGRST205" || /does not exist|could not find the column/i.test(msg);
}

const ARTICLE_LIST_COLUMNS_BASE =
  "id,slug,cover_image_url,image_alt_text,category,secondary_tags,published_at,lang,title_fr,title_de,title_it,title_en,excerpt_fr,excerpt_de,excerpt_it,excerpt_en";
const ARTICLE_LIST_COLUMNS_FULL =
  "id,slug,slug_de,cover_image_url,image_alt_text,category,secondary_tags,published_at,lang,title_fr,title_de,title_it,title_en,excerpt_fr,excerpt_de,excerpt_it,excerpt_en";

// ── Public ────────────────────────────────────────────────────────────────────

export const getPublishedArticles = createServerFn({ method: "GET" })
  .inputValidator(z.object({ lang: z.string().optional(), limit: z.number().optional() }))
  .handler(async ({ data }) => {
    const { holiswissPublic: supabase } = await import("@/integrations/supabase/holiswiss-public");
    const build = (columns: string) => {
      let q = (supabase as any)
        .from("articles")
        .select(columns)
        .eq("status", "validated")
        .order("published_at", { ascending: false });
      if (data.lang) q = q.eq("lang", data.lang as "fr" | "de" | "it" | "en");
      if (data.limit) q = q.limit(data.limit);
      return q;
    };

    const enriched = await build(ARTICLE_LIST_COLUMNS_FULL);
    if (!enriched.error) return { articles: enriched.data ?? [] };
    if (!isMissingColumn(enriched.error)) throw new Error("Impossible de charger les articles.");

    const base = await build(ARTICLE_LIST_COLUMNS_BASE);
    if (base.error) throw new Error("Impossible de charger les articles.");
    return { articles: base.data ?? [] };
  });

export const getArticlesByCategory = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string(), lang: z.string().optional() }))
  .handler(async ({ data }) => {
    const { holiswissPublic: supabase } = await import("@/integrations/supabase/holiswiss-public");
    const build = (columns: string) => {
      let q = (supabase as any)
        .from("articles")
        .select(columns)
        .eq("status", "validated")
        .or(`category.eq.${data.slug},secondary_tags.cs.{${data.slug}}`)
        .order("published_at", { ascending: false });
      if (data.lang) q = q.eq("lang", data.lang as "fr" | "de" | "it" | "en");
      return q;
    };

    const enriched = await build(ARTICLE_LIST_COLUMNS_FULL);
    if (!enriched.error) return { articles: enriched.data ?? [] };
    if (!isMissingColumn(enriched.error)) throw new Error("Impossible de charger les articles de cette catégorie.");

    const base = await build(ARTICLE_LIST_COLUMNS_BASE);
    if (base.error) throw new Error("Impossible de charger les articles de cette catégorie.");
    return { articles: base.data ?? [] };
  });

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string(), lang: z.string().optional() }))
  .handler(async ({ data }) => {
    const { holiswissPublic: supabase } = await import("@/integrations/supabase/holiswiss-public");

    // L'URL peut porter le slug de base (toutes langues) ou le slug localisé
    // (slug_de) : on résout par l'un ou l'autre pour ne jamais 404 un lien existant.
    const enriched = await (supabase as any)
      .from("articles")
      .select("*")
      .or(`slug.eq.${data.slug},slug_de.eq.${data.slug}`)
      .eq("status", "validated")
      .maybeSingle();

    if (!enriched.error) return { article: enriched.data };
    if (!isMissingColumn(enriched.error)) throw new Error("Impossible de charger l'article.");

    // slug_de n'existe pas encore côté base : recherche par slug seul.
    const base = await (supabase as any)
      .from("articles")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "validated")
      .maybeSingle();

    if (base.error) throw new Error("Impossible de charger l'article.");
    return { article: base.data };
  });

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getAllArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    // Use admin client to avoid RLS / has_role permission issues at runtime
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const COLUMNS_BASE = "id,slug,status,lang,category,secondary_tags,published_at,created_at,updated_at,cover_image_url,image_alt_text,author_id,title_fr,title_de,title_it,title_en,excerpt_fr,body_fr,body_de,body_it,body_en,meta_title_fr,meta_description_fr";
    const COLUMNS_FULL = "id,slug,slug_de,status,lang,category,secondary_tags,published_at,created_at,updated_at,cover_image_url,image_alt_text,author_id,title_fr,title_de,title_it,title_en,excerpt_fr,body_fr,body_de,body_it,body_en,meta_title_fr,meta_description_fr";
    const enriched = await (supabaseAdmin as any)
      .from("articles")
      .select(COLUMNS_FULL)
      .order("created_at", { ascending: false });
    if (!enriched.error) return { articles: enriched.data ?? [] };
    if (!isMissingColumn(enriched.error)) throw new Error(`Impossible de charger les articles: ${enriched.error.message}`);

    const base = await (supabaseAdmin as any)
      .from("articles")
      .select(COLUMNS_BASE)
      .order("created_at", { ascending: false });
    if (base.error) throw new Error(`Impossible de charger les articles: ${base.error.message}`);
    return { articles: base.data ?? [] };
  });

const ArticleInputSchema = z.object({
  title_fr: z.string().min(3),
  title_de: z.string().optional().default(""),
  title_it: z.string().optional().default(""),
  title_en: z.string().optional().default(""),
  body_fr: z.string().min(10),
  body_de: z.string().optional().default(""),
  body_it: z.string().optional().default(""),
  body_en: z.string().optional().default(""),
  excerpt_fr: z.string().max(300).optional().default(""),
  excerpt_de: z.string().optional().default(""),
  excerpt_it: z.string().optional().default(""),
  excerpt_en: z.string().optional().default(""),
  slug: z.string().optional(),
  slug_de: z.string().optional().default(""),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  image_alt_text: z.string().max(125).optional().default(""),
  category: z.string().optional(),
  lang: z.enum(["fr", "de", "it", "en"]).default("fr"),
  status: z.enum(["draft", "validated", "pending_validation", "rejected"]).default("draft"),
  meta_title_fr: z.string().optional().default(""),
  meta_description_fr: z.string().optional().default(""),
  secondary_tags: z.array(z.string()).optional().default([]),
});

export const createArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ArticleInputSchema)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const slug = data.slug?.trim() || toSlug(data.title_fr);
    const published_at = data.status === "validated" ? new Date().toISOString() : null;

    const { data: article, error } = await (supabaseAdmin as any)
      .from("articles")
      .insert({
        ...data,
        slug,
        slug_de: data.slug_de?.trim() || null,
        published_at,
        author_id: context.userId,
        cover_image_url: data.cover_image_url || null,
        image_alt_text: data.image_alt_text?.trim() || null,
      })
      .select("id,slug")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Un article avec ce slug (ou ce slug allemand) existe déjà.");
      throw new Error("Impossible de créer l'article.");
    }
    return { article };
  });

export const updateArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ArticleInputSchema.extend({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { id, ...fields } = data;
    const published_at = fields.status === "validated" ? new Date().toISOString() : null;

    const { error } = await (supabaseAdmin as any)
      .from("articles")
      .update({
        ...fields,
        published_at,
        slug_de: fields.slug_de?.trim() || null,
        cover_image_url: fields.cover_image_url || null,
        image_alt_text: fields.image_alt_text?.trim() || null,
      })
      .eq("id", id);

    if (error) {
      if (error.code === "23505") throw new Error("Un article avec ce slug (ou ce slug allemand) existe déjà.");
      throw new Error("Impossible de mettre à jour l'article.");
    }
    return { ok: true };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("articles").delete().eq("id", data.id);
    if (error) throw new Error("Impossible de supprimer l'article.");
    return { ok: true };
  });

export const setArticleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    status: z.enum(["draft", "validated", "pending_validation", "rejected"]),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: data.status };
    patch.published_at = data.status === "validated" ? new Date().toISOString() : null;
    const { error } = await (supabaseAdmin as any).from("articles").update(patch).eq("id", data.id);
    if (error) throw new Error("Impossible de modifier le statut.");
    return { ok: true };
  });
