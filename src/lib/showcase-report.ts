/**
 * Objet d'audit unique : score, catégories, contrôles détaillés, éléments
 * manquants, actions prioritaires et recommandations sont TOUS dérivés ici,
 * à partir des mêmes contrôles (`runShowcaseAudit`). Le frontend affiche ce
 * résultat tel quel, sans reconstruire quoi que ce soit.
 * Module pur : aucune I/O.
 */
import {
  AUDIT_CATEGORY_LABEL,
  type AuditAxis,
  type AuditCategory,
  type AuditCheck,
  type AuditSeverity,
  type ShowcaseInput,
} from "@/lib/showcase-audit";
import { SHOWCASE_ACTIONS } from "@/lib/showcase-actions";
import {
  buildRecommendations,
  isRelevant,
  type Recommendation,
} from "@/lib/showcase-recommendations";

export type CheckStatus = "passed" | "missing" | "invalid" | "pending" | "blocked";

export type ReportCheck = {
  id: string;
  axis: AuditAxis;
  category: AuditCategory;
  categoryLabel: string;
  label: string;
  status: CheckStatus;
  severity: AuditSeverity;
  /** Points sur 100 apportés (ou apportables) par ce contrôle. */
  points: number;
  /** Poids brut dans le barème. */
  weight: number;
  explanation: string;
  currentValueSummary: string;
  expectedValueSummary: string;
  actionKey: string | null;
  actionHref: string | null;
  actionLabel: string | null;
  evaluatedAt: string;
  sourceFields: string[];
  /** Date de passage en conforme, si connue. */
  resolvedAt: string | null;
};

export type AxisReport = {
  score: number;
  total: number;
  checks: ReportCheck[];
  blocking: ReportCheck[];
  recommendations: Recommendation[];
};

export type PriorityAction = {
  rank: number;
  checkId: string;
  label: string;
  explanation: string;
  points: number;
  actionKey: string | null;
  actionHref: string | null;
  actionLabel: string | null;
};

export type ShowcaseAuditReport = {
  visibility: AxisReport;
  conversion: AxisReport;
  missingItems: ReportCheck[];
  priorityActions: PriorityAction[];
  generatedAt: string;
  profileVersion: string | null;
};

/** Champs source de chaque contrôle (colonnes ou agrégats du profil). */
const SOURCE_FIELDS: Record<string, string[]> = {
  identity: ["first_name", "last_name", "title"],
  photo: ["photo_url"],
  bio_length: ["bio"],
  specialties: ["specialties", "approaches"],
  short_bio: ["short_bio"],
  pro_badge: ["subscription_plan", "verified"],
  credentials: ["certificationsVerified"],
  ide_verified: ["ide_verified"],
  training: ["years_experience", "certificationsDeclared"],
  reviews: ["reviewsCount"],
  services: ["services", "packagesCount"],
  durations: ["services", "packagesCount"],
  price: ["price_min", "price_max"],
  availability: ["availabilitiesCount"],
  modes: ["consultation_modes"],
  contact: ["phone", "email"],
  city: ["city"],
  canton: ["canton"],
  address: ["address", "postal_code", "latitude", "longitude"],
  geo_consistency: ["city", "canton", "latitude", "longitude"],
  google_business: ["google_reviews_url"],
  canton_language: ["languages", "canton"],
  languages: ["languages"],
  localized_version: ["languages"],
  hreflang: [],
  canonical: ["slug"],
  meta_title: ["meta_title", "title", "first_name", "last_name", "city"],
  meta_description: ["meta_description"],
  h1: ["first_name", "last_name"],
  structured_data: ["first_name", "city", "specialties"],
  alt_text: ["photo_url", "city"],
  indexable: ["status", "verified"],
  faq: ["faqCount", "booking_note"],
  articles: ["articlesCount"],
  author: ["first_name", "title", "photo_url"],
  method_explained: ["bio"],
  gallery: ["gallery_urls"],
  profile_fresh: ["updated_at"],
  price_fresh: ["price_min", "updated_at"],
  availability_fresh: ["availabilitiesCount", "availabilitiesUpdatedAt"],
  certifications_valid: ["certificationsExpired"],
};

/** Valeur attendue, formulée en langage clair. */
const EXPECTED: Record<string, string> = {
  identity: "Prénom, nom et titre professionnel renseignés",
  photo: "Une photo de portrait en ligne",
  bio_length: "Une présentation d'au moins 300 caractères",
  specialties: "Au moins 2 approches ou spécialités",
  short_bio: "Une accroche d'au moins 60 caractères",
  pro_badge: "Un abonnement Pro ou une fiche vérifiée",
  credentials: "Au moins 1 certification vérifiée",
  ide_verified: "Identifiant professionnel vérifié",
  training: "Formation ou années d'expérience renseignées",
  reviews: "Au moins 1 avis publié",
  services: "Au moins 1 prestation détaillée",
  durations: "Une durée indiquée pour vos séances",
  price: "Un tarif minimum renseigné",
  availability: "Au moins 1 créneau publié",
  modes: "Au moins 1 mode de consultation",
  contact: "Un téléphone ou un e-mail public",
  city: "Ville renseignée",
  canton: "Canton renseigné",
  address: "Adresse, code postal ou coordonnées GPS",
  geo_consistency: "Ville, canton et coordonnées renseignés et cohérents",
  google_business: "Lien vers votre fiche Google",
  canton_language: "La langue officielle de votre canton parmi vos langues",
  languages: "Au moins 1 langue de consultation",
  localized_version: "Au moins 2 langues de consultation",
  hreflang: "Généré automatiquement par Holiswiss",
  canonical: "Générée automatiquement par Holiswiss",
  meta_title: "Un titre SEO de 20 à 60 caractères",
  meta_description: "Une description SEO d'au moins 80 caractères",
  h1: "Prénom et nom renseignés",
  structured_data: "Nom, ville et au moins 1 spécialité",
  alt_text: "Photo et ville renseignées",
  indexable: "Fiche publiée (statut actif)",
  faq: "Des questions fréquentes d'au moins 120 caractères",
  articles: "Au moins 1 article publié",
  author: "Nom, titre professionnel et photo",
  method_explained: "Une présentation d'au moins 600 caractères",
  gallery: "Au moins 1 photo du lieu de consultation",
  profile_fresh: "Profil modifié dans les 6 derniers mois",
  price_fresh: "Tarifs revus dans les 12 derniers mois",
  availability_fresh: "Créneaux publiés dans les 3 derniers mois",
  certifications_valid: "Aucune certification expirée",
};

/** Contrôles en attente d'une validation externe lorsqu'ils sont déclarés. */
const PENDING_WHEN: Record<string, (t: ShowcaseInput) => boolean> = {
  credentials: (t) => (t.certificationsDeclared ?? 0) > 0,
  ide_verified: (t) => (t.ide_verified ?? false) === false && !!t.verified,
};

const isEmptyValue = (v: unknown): boolean =>
  v == null || v === "" || v === false || v === 0 || (Array.isArray(v) && v.length === 0);

function formatValue(field: string, v: unknown): string {
  if (v == null || v === "") return `${field} : non renseigné`;
  if (Array.isArray(v)) return `${field} : ${v.length} élément${v.length > 1 ? "s" : ""}`;
  if (typeof v === "boolean") return `${field} : ${v ? "oui" : "non"}`;
  if (typeof v === "number") return `${field} : ${v}`;
  const s = String(v).replace(/\s+/g, " ").trim();
  const short = s.length > 60 ? `${s.slice(0, 57)}…` : s;
  return `${field} : « ${short} » (${s.length} caractères)`;
}

function summarizeCurrent(t: ShowcaseInput, fields: string[]): string {
  if (fields.length === 0) return "Généré automatiquement par Holiswiss";
  return fields.map((f) => formatValue(f, (t as Record<string, unknown>)[f])).join(" · ");
}

function statusOf(check: AuditCheck, t: ShowcaseInput, fields: string[]): CheckStatus {
  if (check.passed) return "passed";
  if (check.id !== "indexable") {
    const indexableBlocked =
      (t.status ?? "").toLowerCase() !== "active" &&
      (t.status ?? "").toLowerCase() !== "published" &&
      !t.verified;
    if (indexableBlocked && check.axis === "visibilite") return "blocked";
  }
  const pending = PENDING_WHEN[check.id];
  if (pending?.(t)) return "pending";
  const hasSomeValue = fields.some((f) => !isEmptyValue((t as Record<string, unknown>)[f]));
  return hasSomeValue ? "invalid" : "missing";
}

/** Construit l'objet d'audit unique consommé par le frontend. */
export function buildShowcaseAuditReport(
  input: ShowcaseInput,
  checks: AuditCheck[],
  opts: {
    generatedAt: string;
    profileVersion?: string | null;
    resolvedDates?: Record<string, string>;
  },
): ShowcaseAuditReport {
  const { generatedAt, resolvedDates = {} } = opts;
  const maxWeight = checks.reduce((s, c) => s + c.weight, 0) || 1;

  const detailed: ReportCheck[] = checks.map((c) => {
    const sourceFields = SOURCE_FIELDS[c.id] ?? [];
    const action = SHOWCASE_ACTIONS[c.id] ?? null;
    const status = statusOf(c, input, sourceFields);
    return {
      id: c.id,
      axis: c.axis,
      category: c.category,
      categoryLabel: AUDIT_CATEGORY_LABEL[c.category],
      label: c.label,
      status,
      severity: c.severity,
      points: Math.round((c.weight / maxWeight) * 100),
      weight: c.weight,
      explanation: c.hint,
      currentValueSummary: summarizeCurrent(input, sourceFields),
      expectedValueSummary: EXPECTED[c.id] ?? c.label,
      actionKey: status === "passed" || !action ? null : c.id,
      actionHref:
        status === "passed" || !action
          ? null
          : `${action.to}${action.hash ? `#${action.hash}` : ""}`,
      actionLabel: status === "passed" || !action ? null : action.cta,
      evaluatedAt: generatedAt,
      sourceFields,
      resolvedAt: c.passed ? (resolvedDates[c.id] ?? null) : null,
    };
  });

  // Recommandations : une seule construction, à partir des mêmes contrôles.
  const recos = buildRecommendations(
    checks.map((c) => ({ ...c, gain: Math.round((c.weight / maxWeight) * 100) })),
    resolvedDates,
  );
  const recoById = new Map(recos.map((r) => [r.id, r]));

  const axisReport = (axis: AuditAxis): AxisReport => {
    const items = detailed.filter((c) => c.axis === axis);
    const max = items.reduce((s, c) => s + c.weight, 0) || 1;
    const got = items.reduce((s, c) => s + (c.status === "passed" ? c.weight : 0), 0);
    return {
      score: Math.round((got / max) * 100),
      total: items.length,
      checks: items,
      blocking: items.filter((c) => c.status !== "passed" && c.severity === "critical"),
      recommendations: items
        .filter((c) => isRelevant(c))
        .map((c) => recoById.get(c.id))
        .filter((r): r is Recommendation => !!r),
    };
  };

  const severityRank: Record<AuditSeverity, number> = { critical: 0, warning: 1, info: 2 };
  const missingItems = detailed
    .filter((c) => c.status !== "passed")
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.weight - a.weight);

  const priorityActions: PriorityAction[] = missingItems
    .filter((c) => c.actionHref)
    .slice(0, 3)
    .map((c, i) => ({
      rank: i + 1,
      checkId: c.id,
      label: c.label,
      explanation: c.explanation,
      points: c.points,
      actionKey: c.actionKey,
      actionHref: c.actionHref,
      actionLabel: c.actionLabel,
    }));

  return {
    visibility: axisReport("visibilite"),
    conversion: axisReport("conversion"),
    missingItems,
    priorityActions,
    generatedAt,
    profileVersion: opts.profileVersion ?? null,
  };
}
