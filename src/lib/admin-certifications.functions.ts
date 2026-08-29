import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.functions";

/**
 * Validation administrateur des diplômes déclarés par les thérapeutes.
 * La lecture passe par le service-role (jointure sur les thérapeutes) ;
 * l'écriture passe par la session de l'administrateur, seule habilitée par
 * le trigger `therapist_certifications_lock_verification` à changer le statut.
 */
export type CertificationStatus = "declared" | "verified" | "rejected" | "needs_information";

const STATUSES: CertificationStatus[] = ["declared", "verified", "rejected", "needs_information"];

export const listCertificationsToReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({ status: z.enum(["declared", "verified", "rejected", "needs_information", "all"]).optional() })
      .optional(),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { autoCheckCertification } = await import("@/lib/certification-autocheck");

    const status = data?.status ?? "declared";

    let query = supabaseAdmin
      .from("therapist_certifications")
      .select(
        "id,name,issuer,year,file_url,created_at,updated_at,verification_status,verified_at,verified_by,rejected_at,rejected_by,rejection_reason,verification_note,therapist_id",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (status !== "all") query = query.eq("verification_status", status);

    const { data: raw, error } = await query;
    if (error) throw new Error(error.message);

    // Compteurs par statut (pour les onglets).
    const counts: Record<string, number> = { declared: 0, verified: 0, rejected: 0, needs_information: 0, all: 0 };
    const { data: allRows } = await supabaseAdmin.from("therapist_certifications").select("verification_status");
    for (const r of allRows ?? []) {
      const s = (r as any).verification_status as string;
      if (s in counts) counts[s] = (counts[s] ?? 0) + 1;
      counts.all += 1;
    }

    const rows = raw ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.therapist_id)));
    const { data: thers } = ids.length
      ? await supabaseAdmin.from("therapists").select("id,first_name,last_name,slug").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((thers ?? []).map((t: any) => [t.id, t]));

    // Nom/e-mail des administrateurs décisionnaires (visible entre admins).
    const adminIds = Array.from(
      new Set(rows.flatMap((r: any) => [r.verified_by, r.rejected_by]).filter(Boolean)),
    ) as string[];
    const adminLabels = new Map<string, string>();
    for (const uid of adminIds) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (u?.user?.email) adminLabels.set(uid, u.user.email);
      } catch {
        /* nom d'administrateur indisponible : on l'omet simplement */
      }
    }

    return {
      counts,
      rows: await Promise.all(
        rows.map(async (r: any) => {
          let fileUrl: string | null = null;
          if (r.file_url) {
            const { data: s } = await supabaseAdmin.storage.from("therapist-docs").createSignedUrl(r.file_url, 3600);
            fileUrl = s?.signedUrl ?? null;
          }
          const t = byId.get(r.therapist_id);
          return {
            id: r.id as string,
            name: r.name as string,
            issuer: (r.issuer ?? null) as string | null,
            year: (r.year ?? null) as number | null,
            createdAt: r.created_at as string,
            status: (r.verification_status ?? "declared") as CertificationStatus,
            verifiedAt: (r.verified_at ?? null) as string | null,
            verifiedByLabel: r.verified_by ? (adminLabels.get(r.verified_by) ?? null) : null,
            rejectedAt: (r.rejected_at ?? null) as string | null,
            rejectedByLabel: r.rejected_by ? (adminLabels.get(r.rejected_by) ?? null) : null,
            rejectionReason: (r.rejection_reason ?? null) as string | null,
            verificationNote: (r.verification_note ?? null) as string | null,
            fileUrl,
            therapistName: `${t?.first_name ?? ""} ${t?.last_name ?? ""}`.trim() || "—",
            therapistSlug: (t?.slug ?? null) as string | null,
            autoCheck: autoCheckCertification({
              name: r.name,
              issuer: r.issuer,
              year: r.year,
              hasFile: !!r.file_url,
            }),
          };
        }),
      ),
    };
  });

/**
 * Décision d'un administrateur sur un diplôme.
 * L'identité de l'administrateur n'est jamais transmise par le client :
 * elle est déduite de la session et posée par le trigger côté base.
 */
export const reviewCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.string().uuid(),
      decision: z.enum(["verified", "rejected", "needs_information", "reset"]),
      reason: z.string().trim().max(1000).optional().nullable(),
      note: z.string().trim().max(1000).optional().nullable(),
    }),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);

    const { data: current, error: readErr } = await context.supabase
      .from("therapist_certifications")
      .select("id,verification_status")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!current) throw new Error("Diplôme introuvable.");

    const currentStatus = (current as any).verification_status as CertificationStatus;
    const target = data.decision === "reset" ? "declared" : data.decision;

    if (currentStatus === target) {
      throw new Error("Ce diplôme a déjà ce statut.");
    }
    if (target === "rejected" && !data.reason) {
      throw new Error("Un motif de refus est obligatoire.");
    }
    if (currentStatus === "verified" && target !== "verified" && !data.reason) {
      throw new Error("Un motif est obligatoire pour révoquer une validation.");
    }
    if (!STATUSES.includes(target as CertificationStatus)) throw new Error("Statut invalide.");

    const patch: Record<string, unknown> = {
      verification_status: target,
      rejection_reason: target === "rejected" ? data.reason : null,
      verification_note: data.note ?? null,
    };

    const { error } = await context.supabase.from("therapist_certifications").update(patch).eq("id", data.id);
    if (error) {
      console.error("[reviewCertification] échec de mise à jour", { id: data.id, target, error: error.message });
      throw new Error("Impossible d'enregistrer la décision. Veuillez réessayer.");
    }
    return { ok: true, status: target };
  });
