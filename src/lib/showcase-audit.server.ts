/**
 * Chargement des données d'audit vitrine, partagé par l'admin et par le
 * thérapeute lui-même. Un seul moteur de scoring : `runShowcaseAudit`.
 * Le client Supabase est injecté (service-role côté admin, session du
 * thérapeute côté dashboard) — le calcul, lui, est strictement identique.
 */
import { runShowcaseAudit, auditTotals, categoryTotals, type AuditCheck, type ShowcaseInput } from "@/lib/showcase-audit";

export const SHOWCASE_COLUMNS =
  "id,slug,first_name,last_name,title,bio,short_bio,photo_url,city,canton,address,postal_code,latitude,longitude,specialties,approaches,languages,consultation_modes,services,price_min,price_max,meta_title,meta_description,website,google_reviews_url,booking_note,phone,email,verified,ide_verified,years_experience,subscription_plan,status,updated_at,gallery_urls";

export async function loadShowcaseAudit(
  sb: any,
  therapistId: string,
): Promise<{
  slug: string;
  checks: AuditCheck[];
  input: ShowcaseInput;
  totals: { visibilite: number; conversion: number };
  categories: ReturnType<typeof categoryTotals>;
}> {
  const [therRes, certRes, revRes, availRes, artRes, packRes] = await Promise.all([
    sb.from("therapists").select(SHOWCASE_COLUMNS).eq("id", therapistId).maybeSingle(),
    sb.from("therapist_certifications").select("verification_status,expires_at").eq("therapist_id", therapistId),
    sb.from("reviews").select("id").eq("therapist_id", therapistId).eq("status", "approved"),
    sb.from("availabilities").select("id,created_at").eq("therapist_id", therapistId).eq("is_active", true),
    sb.from("therapist_articles").select("id").eq("therapist_id", therapistId).eq("statut", "publie"),
    sb.from("service_packages").select("id").eq("therapist_id", therapistId).eq("actif", true),
  ]);

  const t = therRes.data;
  if (!t) throw new Error("Thérapeute introuvable");

  const certs = (certRes.data ?? []) as Array<{ verification_status: string | null; expires_at: string | null }>;
  const avails = (availRes.data ?? []) as Array<{ created_at: string | null }>;
  const now = Date.now();
  const isExpired = (c: { expires_at: string | null }) =>
    c.expires_at != null && new Date(c.expires_at).getTime() < now;
  const auditInput: ShowcaseInput = {
    ...t,
    // Une certification expirée n'est plus comptée comme vérifiée : elle est
    // rétrogradée en « déclarée », comme sur la vitrine publique.
    certificationsVerified: certs.filter((c) => c.verification_status === "verified" && !isExpired(c)).length,
    certificationsDeclared: certs.filter((c) => c.verification_status !== "verified" || isExpired(c)).length,
    certificationsExpired: certs.filter(isExpired).length,
    reviewsCount: (revRes.data ?? []).length,
    availabilitiesCount: avails.length,
    availabilitiesUpdatedAt: avails
      .map((a) => a.created_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null,
    articlesCount: (artRes.data ?? []).length,
    packagesCount: (packRes.data ?? []).length,
  };
  const checks = runShowcaseAudit(auditInput);

  return {
    slug: (t.slug ?? "") as string,
    checks,
    input: auditInput,
    totals: auditTotals(checks),
    categories: categoryTotals(checks),
  };
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
export async function buildShowcaseReport(
  sb: any,
  therapistId: string,
  persist: boolean,
  opts: { forceAdvanced?: boolean } = {},
) {
  const { basicSummary } = await import("@/lib/showcase-audit");
  const { resolveScoringAccess } = await import("@/lib/scoring-access.server");
  const { buildRecommendations } = await import("@/lib/showcase-recommendations");

  const [audit, access, prevRes] = await Promise.all([
    loadShowcaseAudit(sb, therapistId),
    resolveScoringAccess(sb, therapistId),
    sb
      .from("therapist_showcase_snapshots")
      .select("score,created_at,checks")
      .eq("therapist_id", therapistId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const basic = basicSummary(audit.checks);
  const history = (prevRes?.data ?? []) as Array<{ score: number; created_at: string; checks: any }>;
  const previous = history[0];
  let analyzedAt = new Date().toISOString();

  const shouldPersist = persist || !previous;
  if (shouldPersist) {
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

  /**
   * Date de résolution : premier instantané où un contrôle passe de non
   * conforme à conforme. Uniquement des données réelles ; null si inconnue.
   */
  const resolvedDates: Record<string, string> = {};
  const seenFailed = new Set<string>();
  for (const snap of [...history].reverse()) {
    const list = Array.isArray(snap.checks) ? (snap.checks as Array<{ id: string; passed: boolean }>) : [];
    for (const item of list) {
      if (!item?.id) continue;
      if (!item.passed) {
        seenFailed.add(item.id);
        delete resolvedDates[item.id];
      } else if (seenFailed.has(item.id) && !resolvedDates[item.id]) {
        resolvedDates[item.id] = snap.created_at;
      }
    }
  }
  for (const c of audit.checks) {
    if (c.passed && seenFailed.has(c.id) && !resolvedDates[c.id]) resolvedDates[c.id] = analyzedAt;
  }

  const maxWeight = audit.checks.reduce((s, c) => s + c.weight, 0) || 1;
  const checks = audit.checks.map((c) => ({
    ...c,
    /** Points gagnés sur 100 si ce critère est validé. */
    gain: Math.round((c.weight / maxWeight) * 100),
  }));

  const recommendations = buildRecommendations(checks, resolvedDates);

  return {
    slug: audit.slug,
    recommendations,
    access,
    basic,
    score: basic.score,
    status: showcaseStatus(basic.score),
    analyzedAt,
    /** Score de la dernière analyse enregistrée (avant celle-ci si persist). */
    previousScore: previous ? previous.score : null,
    previousAt: previous ? previous.created_at : null,
    delta: previous ? basic.score - previous.score : null,
    totals: access.advanced || opts.forceAdvanced ? audit.totals : null,
    categories: access.advanced || opts.forceAdvanced ? audit.categories : null,
    checks,
  };
}
