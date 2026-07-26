import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Server functions pour activer les 3 nouveaux critères de l'agent Santé de Profil :
// galerie photos cabinet, certifications, réponses aux avis. Chaque écriture
// déclenche un recalcul ciblé du score (compute_therapist_health_one).

async function getOwnedTherapist(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("therapists").select("id").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Impossible de vérifier le profil thérapeute.");
  if (!data) throw new Error("Complétez d'abord votre profil.");
  return { sb: supabaseAdmin as any, therapistId: data.id as string };
}

async function recompute(sb: any, therapistId: string) {
  try {
    await sb.rpc("compute_therapist_health_one", { _id: therapistId });
  } catch {
    /* best-effort : le cron quotidien rattrapera de toute façon */
  }
}

function pathFrom(url: string, bucket: string): string | null {
  const m = url.match(new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${bucket}/([^?]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/* ---------------- Photos du cabinet (bucket therapist-photos) ---------------- */

export const listMyCabinetPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const { data } = await sb
      .from("therapist_media")
      .select("id,url,created_at")
      .eq("therapist_id", therapistId)
      .eq("kind", "cabinet")
      .order("created_at", { ascending: true });
    const rows = await Promise.all(
      (data ?? []).map(async (m: any) => {
        let signedUrl = m.url as string;
        const p = pathFrom(m.url, "therapist-photos");
        if (p) {
          const { data: s } = await sb.storage.from("therapist-photos").createSignedUrl(p, 3600);
          if (s?.signedUrl) signedUrl = s.signedUrl;
        }
        return { id: m.id as string, signedUrl };
      }),
    );
    return { rows };
  });

export const addCabinetPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ url: z.string().min(1).max(2000) }))
  .handler(async ({ context, data }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const { error } = await sb.from("therapist_media").insert({ therapist_id: therapistId, url: data.url, kind: "cabinet" });
    if (error) throw new Error(error.message);
    await recompute(sb, therapistId);
    return { ok: true };
  });

export const deleteCabinetPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const { data: row } = await sb.from("therapist_media").select("url").eq("id", data.id).eq("therapist_id", therapistId).maybeSingle();
    const { error } = await sb.from("therapist_media").delete().eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    if (row?.url) {
      const p = pathFrom(row.url, "therapist-photos");
      if (p) { try { await sb.storage.from("therapist-photos").remove([p]); } catch { /* ignore */ } }
    }
    await recompute(sb, therapistId);
    return { ok: true };
  });

/* ---------------- Certifications (bucket privé therapist-docs) ---------------- */

export const listMyCertifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const { data } = await sb
      .from("therapist_certifications")
      .select("id,name,issuer,year,file_url,created_at")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    const rows = await Promise.all(
      (data ?? []).map(async (ce: any) => {
        let fileUrl: string | null = null;
        if (ce.file_url) {
          const { data: s } = await sb.storage.from("therapist-docs").createSignedUrl(ce.file_url, 3600);
          fileUrl = s?.signedUrl ?? null;
        }
        return { id: ce.id as string, name: ce.name as string, issuer: ce.issuer as string | null, year: ce.year as number | null, fileUrl };
      }),
    );
    return { rows };
  });

export const addCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      name: z.string().min(1).max(200),
      issuer: z.string().max(200).optional().nullable(),
      year: z.number().int().min(1950).max(2100).optional().nullable(),
      file_path: z.string().max(400).optional().nullable(), // chemin dans le bucket therapist-docs
    }),
  )
  .handler(async ({ context, data }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const { error } = await sb.from("therapist_certifications").insert({
      therapist_id: therapistId,
      name: data.name,
      issuer: data.issuer ?? null,
      year: data.year ?? null,
      file_url: data.file_path ?? null,
    });
    if (error) throw new Error(error.message);
    await recompute(sb, therapistId);
    return { ok: true };
  });

export const deleteCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const { data: row } = await sb.from("therapist_certifications").select("file_url").eq("id", data.id).eq("therapist_id", therapistId).maybeSingle();
    const { error } = await sb.from("therapist_certifications").delete().eq("id", data.id).eq("therapist_id", therapistId);
    if (error) throw new Error(error.message);
    if (row?.file_url) { try { await sb.storage.from("therapist-docs").remove([row.file_url]); } catch { /* ignore */ } }
    await recompute(sb, therapistId);
    return { ok: true };
  });

/* ---------------- Avis : liste + réponse ---------------- */

export const listMyReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const { data, error } = await sb
      .from("reviews")
      .select("id,rating,title,body,created_at,status,therapist_reply,therapist_reply_at")
      .eq("therapist_id", therapistId)
      .in("status", ["validated", "published"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const replyToReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ reviewId: z.string().uuid(), text: z.string().max(2000) }))
  .handler(async ({ context, data }) => {
    const { sb, therapistId } = await getOwnedTherapist(context.userId);
    const clean = data.text.trim();
    const { data: row, error } = await sb
      .from("reviews")
      .update({
        therapist_reply: clean.length ? clean : null,
        therapist_reply_at: clean.length ? new Date().toISOString() : null,
      })
      .eq("id", data.reviewId)
      .eq("therapist_id", therapistId) // garantit que l'avis appartient bien au thérapeute
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Avis introuvable.");
    await recompute(sb, therapistId);
    return { ok: true };
  });
