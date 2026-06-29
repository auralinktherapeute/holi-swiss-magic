import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const searchUnsplashPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) => z.object({ query: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) throw new Error("Unsplash non configuré");
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(data.query)}&per_page=12&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) throw new Error("Erreur Unsplash");
    const json = (await res.json()) as { results?: Array<any> };
    return {
      results: (json.results ?? []).map((p) => ({
        id: p.id as string,
        urls: { small: p.urls?.small as string, regular: p.urls?.regular as string },
        alt_description: (p.alt_description ?? "") as string,
        user: { name: (p.user?.name ?? "") as string, links: { html: (p.user?.links?.html ?? "") as string } },
        links: { download_location: (p.links?.download_location ?? "") as string },
      })),
    };
  });

export const trackUnsplashDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { downloadLocation: string }) =>
    z.object({ downloadLocation: z.string().url().startsWith("https://api.unsplash.com/") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (!key) return { ok: false };
    await fetch(data.downloadLocation, { headers: { Authorization: `Client-ID ${key}` } }).catch(() => {});
    return { ok: true };
  });