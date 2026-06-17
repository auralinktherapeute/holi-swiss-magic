import { supabase } from "@/integrations/supabase/client";

/**
 * Extract the object path from a Supabase storage URL (public or signed) for
 * the `therapist-photos` bucket. Returns null if the URL does not target it.
 */
export function pathFromTherapistPhotoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/therapist-photos\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Resolve a therapist's stored photo URL into something an anonymous browser
 * can actually load. The bucket is private, so the legacy `/object/public/...`
 * URLs no longer work — we re-issue a signed URL using the storage policy that
 * lets anon read photos belonging to active therapists.
 */
export async function resolveTherapistPhotoUrl(url: string | null | undefined): Promise<string> {
  if (!url) return "";
  const path = pathFromTherapistPhotoUrl(url);
  if (!path) return url;
  const { data, error } = await supabase.storage
    .from("therapist-photos")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) return url;
  return data.signedUrl;
}