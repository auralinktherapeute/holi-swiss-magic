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
export const listCertificationsToReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { autoCheckCertification } = await import("@/lib/certification-autocheck");

    const { data, error } = await supabaseAdmin
      .from("therapist_certifications")
      .select("id,name,issuer,year,file_url,created_at,verification_status,therapist_id")
      .eq("verification_status", "declared")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const ids = Array.from(new Set(rows.map((r: any) => r.therapist_id)));
    const { data: thers } = ids.length
      ? await supabaseAdmin.from("therapists").select("id,first_name,last_name,slug").in("id", ids)
      : { data: [] as any[] };
    const byId = new Map((thers ?? []).map((t: any) => [t.id, t]));

    return {
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

export const reviewCertification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), decision: z.enum(["verified", "rejected"]) }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await context.supabase
      .from("therapist_certifications")
      .update({ verification_status: data.decision })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
