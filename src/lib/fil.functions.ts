/**
 * Lecture publique de « Le fil Holiswiss ».
 *
 * Aucune table dédiée : une publication du fil est un article de la table
 * `articles` (donc géré depuis Admin → Articles) dont la catégorie appartient
 * à `FIL_CATEGORY_SLUGS`. Ces fonctions ne font que projeter les lignes
 * existantes dans la forme `FilPost` attendue par les pages publiques.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  FIL_CATEGORY_SLUGS,
  asFilLang,
  type FilLang,
  type FilPost,
} from "@/data/fil-holiswiss";

const LIST_COLUMNS =
  "id,slug,category,cover_image_url,image_alt_text,published_at,created_at,is_featured," +
  "title_fr,title_de,title_it,title_en,excerpt_fr,excerpt_de,excerpt_it,excerpt_en";

function pick(row: Record<string, any>, prefix: string, lang: FilLang): string {
  return (row[`${prefix}_${lang}`] as string) || (row[`${prefix}_fr`] as string) || "";
}

function toPost(row: Record<string, any>, lang: FilLang, withBody = false): FilPost {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    category: String(row.category ?? ""),
    title: pick(row, "title", lang),
    excerpt: pick(row, "excerpt", lang),
    content: withBody ? pick(row, "body", lang) : "",
    image: (row.cover_image_url as string) || null,
    imageAlt: (row.image_alt_text as string) || "",
    date: String(row.published_at ?? row.created_at ?? ""),
    author: null,
    featured: row.is_featured === true,
    seoTitle: (row.meta_title_fr as string) || undefined,
    seoDescription: (row.meta_description_fr as string) || undefined,
  };
}

const inList = `(${FIL_CATEGORY_SLUGS.join(",")})`;

export const getFilPosts = createServerFn({ method: "GET" })
  .inputValidator(z.object({ lang: z.string().optional() }))
  .handler(async ({ data }) => {
    const lang = asFilLang(data.lang);
    const { holiswissPublic: supabase } = await import("@/integrations/supabase/holiswiss-public");
    const { data: rows, error } = await (supabase as any)
      .from("articles")
      .select(LIST_COLUMNS)
      .eq("status", "validated")
      .in("category", FIL_CATEGORY_SLUGS)
      .order("published_at", { ascending: false });
    if (error) return { posts: [] as FilPost[] };
    return { posts: ((rows ?? []) as Array<Record<string, any>>).map((r) => toPost(r, lang)) };
  });

export const getFilPost = createServerFn({ method: "GET" })
  .inputValidator(z.object({ slug: z.string(), lang: z.string().optional() }))
  .handler(async ({ data }) => {
    const lang = asFilLang(data.lang);
    const { holiswissPublic: supabase } = await import("@/integrations/supabase/holiswiss-public");

    const { data: row, error } = await (supabase as any)
      .from("articles")
      .select("*")
      .eq("slug", data.slug)
      .eq("status", "validated")
      .maybeSingle();
    if (error || !row || !FIL_CATEGORY_SLUGS.includes(row.category)) {
      return { post: null as FilPost | null, related: [] as FilPost[] };
    }

    const post = toPost(row, lang, true);

    const { data: others } = await (supabase as any)
      .from("articles")
      .select(LIST_COLUMNS)
      .eq("status", "validated")
      .in("category", FIL_CATEGORY_SLUGS)
      .neq("slug", post.slug)
      .order("published_at", { ascending: false })
      .limit(12);

    const list = ((others ?? []) as Array<Record<string, any>>).map((r) => toPost(r, lang));
    const same = list.filter((p) => p.category === post.category);
    const rest = list.filter((p) => p.category !== post.category);
    return { post, related: [...same, ...rest].slice(0, 3) };
  });

export { inList };
