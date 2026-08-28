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

// La base de production ne possède pas encore les tables/colonnes de ces
// fonctionnalités. Tant qu'elles manquent, l'UI se masque au lieu d'afficher
// une erreur au thérapeute — et s'allumera d'elle-même une fois la migration passée.
function isMissingSchema(error: any): boolean {
  const code = error?.code ?? "";
  const msg = String(error?.message ?? "");
  return (
    code === "42P01" || // undefined_table
    code === "42703" || // undefined_column
    code === "PGRST205" || // table absente du cache PostgREST
    code === "PGRST204" ||
    /does not exist|could not find the (table|column)/i.test(msg)
  );
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
    const { data, error } = await sb
      .from("therapist_media")
      .select("id,url,created_at")
      .eq("therapist_id", therapistId)
      .eq("kind", "cabinet")
      .order("created_at", { ascending: true });
    if (error) {
      if (isMissingSchema(error)) return { rows: [], supported: false };
      throw new Error(error.message);
    }
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
    return { rows, supported: true };
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
    const { data, error } = await sb
      .from("therapist_certifications")
      .select("id,name,issuer,year,file_url,created_at")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false });
    if (error) {
      if (isMissingSchema(error)) return { rows: [], supported: false };
      throw new Error(error.message);
    }
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
    return { rows, supported: true };
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
    const { data: inserted, error } = await sb
      .from("therapist_certifications")
      .insert({
        therapist_id: therapistId,
        name: data.name,
        issuer: data.issuer ?? null,
        year: data.year ?? null,
        file_url: data.file_path ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    await recompute(sb, therapistId);

    // Pré-vérification automatique puis soumission à la validation de
    // l'administrateur. Best-effort : un échec ici ne doit jamais empêcher
    // l'enregistrement du diplôme.
    const { autoCheckCertification } = await import("@/lib/certification-autocheck");
    const check = autoCheckCertification({
      name: data.name,
      issuer: data.issuer ?? null,
      year: data.year ?? null,
      hasFile: !!data.file_path,
    });
    try {
      const { data: ther } = await sb
        .from("therapists")
        .select("first_name,last_name,slug")
        .eq("id", therapistId)
        .maybeSingle();
      const who = `${ther?.first_name ?? ""} ${ther?.last_name ?? ""}`.trim() || "Thérapeute";
      await sb.rpc("create_admin_notification", {
        _kind: "certification_pending",
        _subject: `Diplôme à valider — ${who}`,
        _summary: `${data.name}${data.issuer ? ` · ${data.issuer}` : ""} — ${check.summary}`,
        _link: "/admin/sante-profils",
        _entity_type: "therapist_certification",
        _entity_id: inserted?.id ?? null,
        _data: {
          therapist_id: therapistId,
          therapist_name: who,
          therapist_slug: ther?.slug ?? null,
          certification_id: inserted?.id ?? null,
          name: data.name,
          issuer: data.issuer ?? null,
          year: data.year ?? null,
          has_file: !!data.file_path,
          auto_check: check,
        },
      });
    } catch {
      /* best-effort */
    }

    return { ok: true, autoCheck: check };
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
    // Schéma de production : comment / author_name / status='approved'.
    const base = await sb
      .from("reviews")
      .select("id,rating,comment,author_name,created_at,status")
      .eq("therapist_id", therapistId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    if (base.error) throw new Error(base.error.message);

    // La réponse du praticien n'existe pas encore partout : on la tente à part.
    const enriched = await sb
      .from("reviews")
      .select("id,rating,comment,author_name,created_at,status,therapist_reply,therapist_reply_at,therapist_reply_status")
      .eq("therapist_id", therapistId)
      .eq("status", "approved")
      .order("created_at", { ascending: false });
    const canReply = !enriched.error;
    return { rows: (canReply ? enriched.data : base.data) ?? [], canReply };
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
    if (error) {
      if (isMissingSchema(error)) throw new Error("La réponse aux avis n'est pas encore activée sur cette plateforme.");
      throw new Error(error.message);
    }
    if (!row) throw new Error("Avis introuvable.");
    await recompute(sb, therapistId);
    // Le trigger DB place la réponse en 'pending'. Notifier l'admin pour modération.
    if (clean.length) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: th } = await supabaseAdmin
          .from("therapists")
          .select("first_name,last_name,slug")
          .eq("id", therapistId)
          .maybeSingle();
        const fullName = th ? `${th.first_name ?? ""} ${th.last_name ?? ""}`.trim() : "Thérapeute";
        await (supabaseAdmin as any).from("notifications").upsert(
          {
            kind: "review_reply_pending",
            subject: `Réponse à un avis à valider — ${fullName}`,
            summary: clean.slice(0, 240),
            link: "/admin/avis",
            entity_type: "reviews",
            entity_id: data.reviewId,
            is_read: false,
            read_at: null,
          },
          { onConflict: "kind,entity_type,entity_id" },
        );
      } catch {
        /* la notification est un plus, ne bloque pas la publication */
      }
    }
    return { ok: true };
  });

/** Admin : approuver ou refuser la réponse d'un thérapeute à un avis. */
export const moderateTherapistReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ reviewId: z.string().uuid(), action: z.enum(["approve", "reject"]) }))
  .handler(async ({ context, data }) => {
    const { assertAdmin } = await import("@/lib/admin.functions");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = data.action === "approve" ? "approved" : "rejected";
    const { error } = await (supabaseAdmin as any)
      .from("reviews")
      .update({
        therapist_reply_status: status,
        therapist_reply_reviewed_at: new Date().toISOString(),
        therapist_reply_reviewed_by: context.userId,
      })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true, status };
  });

/** Admin : liste des réponses en attente de validation. */
export const listPendingTherapistReplies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin.functions");
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("reviews")
      .select("id,rating,comment,author_name,created_at,therapist_id,therapist_reply,therapist_reply_submitted_at,therapists(first_name,last_name,slug)")
      .eq("therapist_reply_status", "pending")
      .not("therapist_reply", "is", null)
      .order("therapist_reply_submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: (data ?? []) as any[] };
  });
