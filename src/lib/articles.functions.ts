import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Public ────────────────────────────────────────────────────────────────────

export const getPublishedArticles = createServerFn({ method: "GET" })
  .inputValidator(z.object({ lang: z.string().optional(), limit: z.number().optional() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("articles")
      .select("id,title,slug,excerpt,cover_image_url,category,author,published_at,lang")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (data.lang) q = q.eq("lang", data.lang);
    if (data.limit) q = q.limit(data.limit);

    const { data: rows, error } = await q;
    if (error) throw new Error("Impossible de charger les articles.");
    return { articles: rows ?? [] };
  });

export const getArticleBySlug = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: article, error } = await supabaseAdmin
      .from("articles")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error("Impossible de charger l'article.");
    return { article };
  });

// ── Admin ─────────────────────────────────────────────────────────────────────

export const getAllArticlesAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("articles")
      .select("id,title,slug,status,lang,category,published_at,created_at,cover_image_url")
      .order("created_at", { ascending: false });

    if (error) throw new Error("Impossible de charger les articles.");
    return { articles: data ?? [] };
  });

const ArticleInputSchema = z.object({
  title: z.string().min(3),
  slug: z.string().optional(),
  content: z.string().min(10),
  excerpt: z.string().max(300).optional(),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  category: z.string().optional(),
  author: z.string().optional(),
  lang: z.enum(["fr", "de", "en", "it"]).default("fr"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export const createArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ArticleInputSchema)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const slug = data.slug?.trim() || toSlug(data.title);
    const published_at = data.status === "published" ? new Date().toISOString() : null;

    const { data: article, error } = await supabaseAdmin
      .from("articles")
      .insert({
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt || null,
        cover_image_url: data.cover_image_url || null,
        category: data.category || null,
        author: data.author || null,
        lang: data.lang,
        status: data.status,
        published_at,
        author_id: context.userId,
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
    const published_at = fields.status === "published" ? new Date().toISOString() : null;

    const { error } = await supabaseAdmin
      .from("articles")
      .update({ ...fields, published_at })
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
    const { error } = await supabaseAdmin.from("articles").delete().eq("id", data.id);
    if (error) throw new Error("Impossible de supprimer l'article.");
    return { ok: true };
  });
