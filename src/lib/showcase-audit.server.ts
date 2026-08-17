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

/** Statut lisible du score global. */
export type ShowcaseStatus = "a_renforcer" | "en_bonne_voie" | "solide" | "excellent";

export function showcaseStatus(score: number): ShowcaseStatus {
  if (score >= 85) return "excellent";
  if (score >= 70) return "solide";
  if (score >= 50) return "en_bonne_voie";
  return "a_renforcer";
}

/**
 * Rapport complet « Score de visibilité » du thérapeute connecté.
 * Aucun recalcul parallèle : réutilise `loadShowcaseAudit` (moteur commun)
 * et `resolveScoringAccess` (niveau d'accès).
 * `persist` enregistre un instantané (bouton « Relancer l'analyse »).
 */
export async function buildShowcaseReport(sb: any, therapistId: string, persist: boolean) {
  const { basicSummary } = await import("@/lib/showcase-audit");
  const { resolveScoringAccess } = await import("@/lib/scoring-access.server");

  const [audit, access, prevRes] = await Promise.all([
    loadShowcaseAudit(sb, therapistId),
    resolveScoringAccess(sb, therapistId),
    sb
      .from("therapist_showcase_snapshots")
      .select("score,created_at")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const basic = basicSummary(audit.checks);
  const previous = (prevRes?.data ?? [])[0] as { score: number; created_at: string } | undefined;
  let analyzedAt = new Date().toISOString();

  if (persist) {
    const { data: inserted } = await sb
      .from("therapist_showcase_snapshots")
      .insert({
        therapist_id: therapistId,
        score: basic.score,
        score_visibilite: audit.totals.visibilite,
        score_conversion: audit.totals.conversion,
        completed: basic.completed,
        total: basic.total,
        checks: audit.checks,
      })
      .select("created_at")
      .maybeSingle();
    if (inserted?.created_at) analyzedAt = inserted.created_at as string;
  } else if (previous) {
    analyzedAt = previous.created_at;
  }

  const maxWeight = audit.checks.reduce((s, c) => s + c.weight, 0) || 1;
  const checks = audit.checks.map((c) => ({
    ...c,
    /** Points gagnés sur 100 si ce critère est validé. */
    gain: Math.round((c.weight / maxWeight) * 100),
  }));

  return {
    slug: audit.slug,
    access,
    basic,
    score: basic.score,
    status: showcaseStatus(basic.score),
    analyzedAt,
    /** Score de la dernière analyse enregistrée (avant celle-ci si persist). */
    previousScore: previous ? previous.score : null,
    previousAt: previous ? previous.created_at : null,
    delta: previous ? basic.score - previous.score : null,
    totals: access.advanced ? audit.totals : null,
    checks,
  };
}
