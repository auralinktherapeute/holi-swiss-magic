import { supabase } from "@/integrations/supabase/client";
import { createSignedImageUrl, type ImageVariant } from "@/lib/storage-image";

const resolvedPhotoUrls = new Map<string, Promise<string>>();

/**
 * Extract the object path from a Supabase storage URL (public or signed) for
 * the `therapist-photos` bucket. Returns null if the URL does not target it.
 */
export function pathFromTherapistPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /\/storage\/v1\/object\/(?:public|sign|authenticated)\/therapist-photos\/([^?]+)/,
  );
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Resolve a therapist's stored photo URL into something an anonymous browser
 * can actually load. The bucket is private, so the legacy `/object/public/...`
 * URLs no longer work — we re-issue a signed URL using the storage policy that
 * lets anon read photos belonging to active therapists.
 */
export async function resolveTherapistPhotoUrl(
  url: string | null | undefined,
  variant: Extract<ImageVariant, "thumbnail" | "profile"> = "thumbnail",
): Promise<string> {
  if (!url) return "";
  const path = pathFromTherapistPhotoUrl(url);
  if (!path) return url;
  // Une URL déjà signée par le serveur est réutilisée telle quelle : cela
  // évite une seconde signature et une seconde adresse pour la même image.
  if (/\/storage\/v1\/object\/sign\/therapist-photos\//.test(url)) return url;

  const cacheKey = `${variant}:${path}`;
  const cached = resolvedPhotoUrls.get(cacheKey);
  if (cached) return cached;

  const pending = createSignedImageUrl(
    supabase.storage.from("therapist-photos"),
    path,
    60 * 60 * 24 * 7,
    variant,
  ).then((signedUrl) => signedUrl ?? url);
  resolvedPhotoUrls.set(cacheKey, pending);
  return pending;
}
