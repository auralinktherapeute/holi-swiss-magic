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

// ── Public ────────────────────────────────────────────────────────────────────

export const getPublishedArticles = createServerFn({ method: "GET" })
  .inputValidator(z.object({ lang: z.string().optional(), limit: z.number().optional() }))
  .handler(async ({ data }) => {
    const { holiswissPublic: supabase } = await import("@/integrations/supabase/holiswiss-public");
    let q = (supabase as any)
      .from("articles")
      .select("id,slug,cover_image_url,category,published_at,lang,title_fr,title_de,title_it,title_en,excerpt_fr,excerpt_de,excerpt_it,excerpt_en")
      .eq("status", "validated")
      .order("published_at", { ascending: false });

    if (data.lang) q = q.eq("lang", data.lang as "fr" | "de" | "it" | "en");
    if (data.limit) q = q.limit(data.limit);

    const { data: rows, error } = await q;
    if (error) throw new Error("Impossible de charger les articles.");
    return { articles: rows ?? [] };
  });

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const { holiswissPublic: supabase } = await import("@/integrations/supabase/holiswiss-public");
    const { data: article, error } = await (supabase as any)
      .from("articles")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "validated")
      .maybeSingle();

    if (error) throw new Error("Impossible de charger l'article.");
    return { article };
  });

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getAllArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    // Use authenticated user client (RLS policy admin_all_articles allows admins to see all statuses)
    const { data, error } = await (context.supabase as any)
      .from("articles")
      .select("id,slug,status,lang,category,published_at,created_at,updated_at,cover_image_url,author_id,title_fr,title_de,title_it,title_en,excerpt_fr,body_fr,meta_title_fr,meta_description_fr")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Impossible de charger les articles: ${error.message}`);
    return { articles: data ?? [] };
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
  cover_image_url: z.string().url().optional().or(z.literal("")),
  category: z.string().optional(),
  lang: z.enum(["fr", "de", "it", "en"]).default("fr"),
  status: z.enum(["draft", "validated", "pending_validation", "rejected"]).default("draft"),
  meta_title_fr: z.string().optional().default(""),
  meta_description_fr: z.string().optional().default(""),
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
        published_at,
        author_id: context.userId,
        cover_image_url: data.cover_image_url || null,
      })
      .select("id,slug")
      .single();

    if (error) {
      if (error.code === "23505") throw new Error("Un article avec ce slug existe déjà.");
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
      .update({ ...fields, published_at, cover_image_url: fields.cover_image_url || null })
      .eq("id", id);

    if (error) throw new Error("Impossible de mettre à jour l'article.");
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
