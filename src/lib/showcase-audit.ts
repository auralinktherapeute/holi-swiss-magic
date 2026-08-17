/**
 * Contrôles automatiques de la vitrine publique d'un thérapeute.
 * Module pur : aucune I/O, réutilisable côté serveur (admin) et côté
 * dashboard thérapeute.
 *
 * Deux axes de lecture conservés :
 *  - visibilite : ce qui conditionne le référencement (SEO / IA)
 *  - conversion : ce qui transforme une visite en prise de contact
 * Et une organisation en 8 catégories métier (voir AUDIT_CATEGORIES).
 */

export type AuditAxis = "visibilite" | "conversion";
export type AuditSeverity = "critical" | "warning" | "info";

export type AuditCategory =
  | "profil"
  | "confiance"
  | "prestations"
  | "seo_local"
  | "langues"
  | "seo_technique"
  | "contenu"
  | "fraicheur";

export const AUDIT_CATEGORIES: Array<{ id: AuditCategory; label: string; hint: string }> = [
  { id: "profil", label: "Profil professionnel", hint: "Qui vous êtes, ce que vous proposez et pour qui." },
  { id: "confiance", label: "Confiance", hint: "Les preuves qui rassurent avant une première séance." },
  { id: "prestations", label: "Prestations et conversion", hint: "Ce qu'un visiteur doit savoir pour vous contacter." },
  { id: "seo_local", label: "SEO local", hint: "Votre ancrage géographique pour les recherches locales." },
  { id: "langues", label: "Langues et localisation", hint: "Cohérence linguistique avec votre canton." },
  { id: "seo_technique", label: "SEO technique", hint: "Les balises lues par Google et les moteurs IA." },
  { id: "contenu", label: "Contenu expert et IA", hint: "Ce qui vous positionne comme référence sur votre méthode." },
  { id: "fraicheur", label: "Fraîcheur", hint: "Une fiche à jour est mieux classée et plus crédible." },
];

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = AUDIT_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.label }),
  {} as Record<AuditCategory, string>,
);

export type AuditCheck = {
  id: string;
  axis: AuditAxis;
  category: AuditCategory;
  label: string;
  hint: string;
  weight: number;
  passed: boolean;
  severity: AuditSeverity;
};

export type ShowcaseInput = {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  bio?: string | null;
  short_bio?: string | null;
  photo_url?: string | null;
  city?: string | null;
  canton?: string | null;
  address?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  specialties?: string[] | null;
  approaches?: string[] | null;
  languages?: string[] | null;
  consultation_modes?: string[] | null;
  services?: unknown;
  price_min?: number | null;
  price_max?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website?: string | null;
  google_reviews_url?: string | null;
  booking_note?: string | null;
  phone?: string | null;
  email?: string | null;
  verified?: boolean | null;
  ide_verified?: boolean | null;
  years_experience?: number | null;
  subscription_plan?: string | null;
  status?: string | null;
  updated_at?: string | null;
  gallery_urls?: string[] | null;
  certificationsVerified?: number;
  certificationsDeclared?: number;
  certificationsExpired?: number;
  reviewsCount?: number;
  availabilitiesCount?: number;
  availabilitiesUpdatedAt?: string | null;
  articlesCount?: number;
  packagesCount?: number;
};

const len = (v?: string | null) => (v ?? "").trim().length;
const count = (v?: unknown[] | null) => (Array.isArray(v) ? v.length : 0);
const daysSince = (iso?: string | null) => {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (Date.now() - t) / 86_400_000;
};

/** Langue attendue par canton (langue officielle principale). */
const CANTON_LANG: Record<string, string> = {
  GE: "fr", VD: "fr", NE: "fr", JU: "fr", FR: "fr", VS: "fr",
  ZH: "de", BE: "de", LU: "de", UR: "de", SZ: "de", OW: "de", NW: "de", GL: "de",
  ZG: "de", SO: "de", BS: "de", BL: "de", SH: "de", AR: "de", AI: "de", SG: "de",
  AG: "de", TG: "de", GR: "de", TI: "it",
};

const normLang = (l: string) => l.trim().toLowerCase().slice(0, 2);

function servicesCount(services: unknown): number {
  if (Array.isArray(services)) return services.length;
  if (services && typeof services === "object") return Object.keys(services as object).length;
  return 0;
}

function servicesHaveDuration(services: unknown): boolean {
  const list = Array.isArray(services) ? services : [];
  return list.some((s: any) => s && typeof s === "object" && (s.duree || s.duration || s.duration_min || s.duree_min));
}

export function runShowcaseAudit(t: ShowcaseInput): AuditCheck[] {
  const c = (
    id: string,
    axis: AuditAxis,
    category: AuditCategory,
    label: string,
    hint: string,
    weight: number,
    passed: boolean,
    severity: AuditSeverity = "warning",
  ): AuditCheck => ({ id, axis, category, label, hint, weight, passed, severity });

  const cantonKey = (t.canton ?? "").trim().toUpperCase().slice(0, 2);
  const expectedLang = CANTON_LANG[cantonKey];
  const langs = (t.languages ?? []).map(normLang);
  const plan = (t.subscription_plan ?? "").toLowerCase();
  const isPro = plan.includes("pro") || plan.includes("elite") || plan.includes("premium");
  const hasGeo = t.latitude != null && t.longitude != null;
  const priceUpToDate = t.price_min != null && daysSince(t.updated_at) <= 365;

  // Identity: distinguish first_name / last_name / title (professional title,
  // persisted in therapists.title — the same column read by the public page).
  const hasFirstName = len(t.first_name) > 0;
  const hasLastName = len(t.last_name) > 0;
  const hasProTitle = len(t.title) > 0;
  const identityPassed = hasFirstName && hasLastName && hasProTitle;
  const identityHint = identityPassed
    ? "Votre identité et votre titre professionnel sont complets."
    : !hasFirstName || !hasLastName
      ? (hasProTitle
          ? "Votre titre professionnel est renseigné. Complétez votre prénom et votre nom."
          : "Renseignez votre prénom, votre nom et votre titre professionnel (ex. « Naturopathe »).")
      : "Votre prénom et votre nom sont renseignés. Ajoutez maintenant votre titre professionnel (ex. « Naturopathe »).";

  return [
    // ── 1. Profil professionnel ─────────────────────────────────────────
    c("identity", "visibilite", "profil", "Nom et titre professionnel",
      identityHint,
      6, identityPassed, "critical"),
    c("photo", "visibilite", "profil", "Photo de profil",
      "La photo est l'image sociale de la fiche (partages, aperçus).",
      10, len(t.photo_url) > 0, "critical"),
    c("bio_length", "visibilite", "profil", "Présentation ≥ 300 caractères",
      "Une fiche de moins de 300 caractères est jugée « contenu mince » et n'est pas indexée.",
      16, len(t.bio) >= 300, "critical"),
    c("specialties", "visibilite", "profil", "Méthodes et approches (≥ 2)",
      "Les spécialités rattachent la fiche aux pages canton × spécialité.",
      12, count(t.specialties) + count(t.approaches) >= 2, "critical"),
    c("short_bio", "visibilite", "profil", "Public accompagné précisé",
      "L'accroche indique à qui vous vous adressez ; elle sert aussi de résumé dans les listes.",
      8, len(t.short_bio) >= 60),

    // ── 2. Confiance ────────────────────────────────────────────────────
    c("pro_badge", "conversion", "confiance", "Badge Pro Holiswiss",
      "Le badge Pro distingue votre fiche dans les listes de résultats.",
      6, isPro || !!t.verified, "info"),
    c("credentials", "visibilite", "confiance", "Certification vérifiée",
      "Une certification vérifiée est balisée en hasCredential — un signal de confiance fort.",
      8, (t.certificationsVerified ?? 0) > 0),
    c("ide_verified", "conversion", "confiance", "Identifiant professionnel vérifié",
      "Le numéro professionnel vérifié atteste de votre existence légale en Suisse.",
      6, !!t.ide_verified, "info"),
    c("training", "visibilite", "confiance", "Formation renseignée",
      "Formations et années d'expérience nourrissent le balisage de vos qualifications.",
      6, (t.certificationsDeclared ?? 0) + (t.certificationsVerified ?? 0) > 0 || (t.years_experience ?? 0) > 0),
    c("reviews", "conversion", "confiance", "Avis authentifiés publiés",
      "Les avis affichés sont la preuve sociale la plus lue.",
      12, (t.reviewsCount ?? 0) > 0),

    // ── 3. Prestations et conversion ────────────────────────────────────
    c("services", "conversion", "prestations", "Prestations détaillées",
      "Lister vos prestations permet au visiteur de choisir avant de vous écrire.",
      10, servicesCount(t.services) > 0 || (t.packagesCount ?? 0) > 0),
    c("durations", "conversion", "prestations", "Durées de séance indiquées",
      "Connaître la durée d'une séance évite une question et accélère la décision.",
      6, servicesHaveDuration(t.services) || (t.packagesCount ?? 0) > 0, "info"),
    c("price", "conversion", "prestations", "Tarifs indiqués",
      "L'absence de tarif est la première cause d'abandon avant contact.",
      14, t.price_min != null, "critical"),
    c("availability", "conversion", "prestations", "Disponibilités publiées",
      "Sans créneau, le module de réservation reste vide.",
      14, (t.availabilitiesCount ?? 0) > 0, "critical"),
    c("modes", "conversion", "prestations", "Modes de consultation et CTA de réservation",
      "Cabinet, visio ou domicile : le visiteur doit savoir comment vous voir et où réserver.",
      10, count(t.consultation_modes) >= 1),
    c("contact", "conversion", "prestations", "Moyen de contact renseigné",
      "Un téléphone ou un e-mail public reste le canal préféré d'une partie des visiteurs.",
      8, len(t.phone) > 0 || len(t.email) > 0),

    // ── 4. SEO local ────────────────────────────────────────────────────
    c("city", "visibilite", "seo_local", "Ville renseignée",
      "La ville est le premier critère des recherches « thérapeute à … ».",
      10, len(t.city) > 0, "critical"),
    c("canton", "visibilite", "seo_local", "Canton renseigné",
      "Le canton alimente les pages régionales et le filtrage géographique.",
      8, len(t.canton) > 0, "critical"),
    c("address", "visibilite", "seo_local", "Adresse ou zone d'intervention",
      "Une adresse (ou une zone) permet le balisage LocalBusiness et l'affichage sur la carte.",
      8, len(t.address) > 0 || len(t.postal_code) > 0 || hasGeo),
    c("geo_consistency", "visibilite", "seo_local", "Informations géographiques cohérentes",
      "Ville, canton et coordonnées doivent concorder, sinon la fiche sort des recherches locales.",
      8, len(t.city) > 0 && len(t.canton) > 0 && hasGeo, "critical"),
    c("google_business", "visibilite", "seo_local", "Google Business Profile relié",
      "Relier votre fiche Google renforce la cohérence de vos informations locales.",
      4, len(t.google_reviews_url) > 0, "info"),

    // ── 5. Langues et localisation ──────────────────────────────────────
    c("canton_language", "visibilite", "langues", "Langue principale du canton couverte",
      "Proposer la langue officielle de votre canton est attendu par les visiteurs et par Google.",
      6, !expectedLang || langs.includes(expectedLang)),
    c("languages", "visibilite", "langues", "Langues de consultation déclarées",
      "Les langues déclarées alimentent le balisage knowsLanguage.",
      6, count(t.languages) >= 1),
    c("localized_version", "visibilite", "langues", "Version localisée disponible",
      "Une seconde langue ouvre votre fiche aux visiteurs des cantons voisins.",
      4, langs.length >= 2, "info"),
    c("hreflang", "visibilite", "langues", "Balises hreflang",
      "Générées automatiquement par Holiswiss dès que votre fiche est publiée.",
      3, true, "info"),
    c("canonical", "visibilite", "langues", "URL canonique",
      "Générée automatiquement par Holiswiss : elle évite le contenu dupliqué.",
      3, true, "info"),

    // ── 6. SEO technique ────────────────────────────────────────────────
    c("meta_title", "visibilite", "seo_technique", "Title SEO",
      "Le title est le texte cliquable dans les résultats de recherche.",
      8, len(t.meta_title) >= 20),
    c("meta_description", "visibilite", "seo_technique", "Meta description",
      "Sans meta description, Google génère un extrait arbitraire.",
      8, len(t.meta_description) >= 80),
    c("h1", "visibilite", "seo_technique", "H1 de la fiche",
      "Le H1 reprend votre nom et votre titre : il doit être renseigné.",
      5, len(t.first_name) > 0 && len(t.last_name) > 0),
    c("structured_data", "visibilite", "seo_technique", "Données structurées complètes",
      "Le balisage Schema.org exige au minimum nom, ville et spécialité.",
      6, len(t.city) > 0 && count(t.specialties) >= 1 && len(t.first_name) > 0),
    c("alt_text", "visibilite", "seo_technique", "Texte alternatif des images",
      "Généré à partir de votre nom et de votre ville : ces champs doivent être remplis.",
      4, len(t.photo_url) > 0 && len(t.city) > 0, "info"),
    c("indexable", "visibilite", "seo_technique", "Fiche indexable",
      "Une fiche non publiée est exclue de l'index des moteurs.",
      8, (t.status ?? "").toLowerCase() === "active" || (t.status ?? "").toLowerCase() === "published" || !!t.verified, "critical"),

    // ── 7. Contenu expert et IA ─────────────────────────────────────────
    c("faq", "visibilite", "contenu", "Questions fréquentes renseignées",
      "Une FAQ est la source privilégiée des réponses générées par les IA.",
      6, len(t.booking_note) >= 120, "info"),
    c("articles", "visibilite", "contenu", "Articles publiés",
      "Publier dans « Voix d'experts » crée des pages qui pointent vers votre fiche.",
      8, (t.articlesCount ?? 0) > 0),
    c("author", "visibilite", "contenu", "Auteur identifié",
      "Vos contenus doivent être signés par un profil complet (nom, titre, photo).",
      4, len(t.first_name) > 0 && len(t.title) > 0 && len(t.photo_url) > 0, "info"),
    c("method_explained", "visibilite", "contenu", "Méthode clairement expliquée",
      "Une présentation détaillée (≥ 600 caractères) explique votre approche aux moteurs IA.",
      6, len(t.bio) >= 600, "info"),
    c("gallery", "conversion", "contenu", "Photos du cabinet",
      "Voir le lieu rassure avant une première séance.",
      4, count(t.gallery_urls) > 0, "info"),

    // ── 8. Fraîcheur ────────────────────────────────────────────────────
    c("profile_fresh", "visibilite", "fraicheur", "Profil mis à jour récemment",
      "Une fiche modifiée dans les 6 derniers mois est jugée active.",
      8, daysSince(t.updated_at) <= 180),
    c("price_fresh", "conversion", "fraicheur", "Tarifs à jour",
      "Des tarifs vieux de plus d'un an découragent la prise de contact.",
      5, priceUpToDate),
    c("availability_fresh", "conversion", "fraicheur", "Disponibilités à jour",
      "Des créneaux publiés il y a plus de 3 mois ne reflètent plus votre agenda.",
      6, (t.availabilitiesCount ?? 0) > 0 && daysSince(t.availabilitiesUpdatedAt) <= 90),
    c("certifications_valid", "visibilite", "fraicheur", "Certifications non expirées",
      "Une certification expirée affaiblit la confiance et le balisage de vos qualifications.",
      5, (t.certificationsExpired ?? 0) === 0, "info"),
  ];
}

export function auditTotals(checks: AuditCheck[]) {
  const per = (axis: AuditAxis) => {
    const items = checks.filter((c) => c.axis === axis);
    const max = items.reduce((s, c) => s + c.weight, 0) || 1;
    const got = items.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
    return Math.round((got / max) * 100);
  };
  return { visibilite: per("visibilite"), conversion: per("conversion") };
}

/** Score 0-100 par catégorie, dans l'ordre déclaré. */
export function categoryTotals(checks: AuditCheck[]) {
  return AUDIT_CATEGORIES.map((cat) => {
    const items = checks.filter((c) => c.category === cat.id);
    const max = items.reduce((s, c) => s + c.weight, 0) || 1;
    const got = items.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
    return {
      id: cat.id,
      label: cat.label,
      hint: cat.hint,
      score: Math.round((got / max) * 100),
      passed: items.filter((c) => c.passed).length,
      total: items.length,
    };
  });
}

export type BasicSummary = {
  /** Score global simplifié, pondéré sur l'ensemble des contrôles. */
  score: number;
  /** Niveau de complétion : nombre de contrôles validés. */
  completed: number;
  total: number;
  /** Essentiels manquants (contrôles critiques), limités aux 3 premiers. */
  essentials: Array<Pick<AuditCheck, "id" | "label" | "hint">>;
  /** Recommandations générales, sans détail du barème. */
  recommendations: string[];
};

/**
 * Vue simplifiée du niveau 1. Aucun second calcul : uniquement une
 * agrégation des contrôles déjà produits par `runShowcaseAudit`.
 */
export function basicSummary(checks: AuditCheck[]): BasicSummary {
  const max = checks.reduce((s, c) => s + c.weight, 0) || 1;
  const got = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  const missing = checks.filter((c) => !c.passed);
  const essentials = missing
    .filter((c) => c.severity === "critical")
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map((c) => ({ id: c.id, label: c.label, hint: c.hint }));

  const recommendations: string[] = [];
  if (missing.some((c) => c.axis === "visibilite"))
    recommendations.push("Complétez le contenu de votre fiche : c'est ce que les moteurs lisent en premier.");
  if (missing.some((c) => c.axis === "conversion"))
    recommendations.push("Ajoutez les informations pratiques (tarif, modes, disponibilités) attendues avant une prise de contact.");
  if (missing.length === 0)
    recommendations.push("Votre fiche couvre tous les points essentiels : pensez à la mettre à jour régulièrement.");

  return {
    score: Math.round((got / max) * 100),
    completed: checks.filter((c) => c.passed).length,
    total: checks.length,
    essentials,
    recommendations,
  };
}
