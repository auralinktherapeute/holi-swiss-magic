/**
 * Chargement des données d'audit vitrine, partagé par l'admin et par le
 * thérapeute lui-même. Un seul moteur de scoring : `runShowcaseAudit`.
 * Le client Supabase est injecté (service-role côté admin, session du
 * thérapeute côté dashboard) — le calcul, lui, est strictement identique.
 */
import { runShowcaseAudit, auditTotals, type AuditCheck } from "@/lib/showcase-audit";

export const SHOWCASE_COLUMNS =
  "id,slug,bio,short_bio,photo_url,city,canton,latitude,longitude,specialties,languages,consultation_modes,price_min,meta_title,meta_description,website,booking_note,verified,gallery_urls";

export async function loadShowcaseAudit(
  sb: any,
  therapistId: string,
): Promise<{ slug: string; checks: AuditCheck[]; totals: { visibilite: number; conversion: number } }> {
  const [therRes, certRes, revRes, availRes] = await Promise.all([
    sb.from("therapists").select(SHOWCASE_COLUMNS).eq("id", therapistId).maybeSingle(),
    sb.from("therapist_certifications").select("verification_status").eq("therapist_id", therapistId),
    sb.from("reviews").select("id").eq("therapist_id", therapistId).eq("status", "approved"),
    sb.from("availabilities").select("id").eq("therapist_id", therapistId).eq("is_active", true),
  ]);

  const t = therRes.data;
  if (!t) throw new Error("Thérapeute introuvable");

  const certs = (certRes.data ?? []) as Array<{ verification_status: string | null }>;
  const checks = runShowcaseAudit({
    ...t,
    certificationsVerified: certs.filter((c) => c.verification_status === "verified").length,
    certificationsDeclared: certs.filter((c) => c.verification_status !== "verified").length,
    reviewsCount: (revRes.data ?? []).length,
    availabilitiesCount: (availRes.data ?? []).length,
  });

  return { slug: (t.slug ?? "") as string, checks, totals: auditTotals(checks) };
}
