/**
 * Contrôles automatiques de la vitrine publique d'un thérapeute.
 * Module pur : aucune I/O, réutilisable côté serveur (admin) et côté
 * dashboard thérapeute.
 *
 * Deux totaux distincts :
 *  - visibilite : ce qui conditionne le référencement (SEO / IA)
 *  - conversion : ce qui transforme une visite en prise de contact
 */

export type AuditAxis = "visibilite" | "conversion";
export type AuditSeverity = "critical" | "warning" | "info";

export type AuditCheck = {
  id: string;
  axis: AuditAxis;
  label: string;
  hint: string;
  weight: number;
  passed: boolean;
  severity: AuditSeverity;
};

export type ShowcaseInput = {
  bio?: string | null;
  short_bio?: string | null;
  photo_url?: string | null;
  city?: string | null;
  canton?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  specialties?: string[] | null;
  languages?: string[] | null;
  consultation_modes?: string[] | null;
  price_min?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  website?: string | null;
  booking_note?: string | null;
  verified?: boolean | null;
  gallery_urls?: string[] | null;
  certificationsVerified?: number;
  certificationsDeclared?: number;
  reviewsCount?: number;
  availabilitiesCount?: number;
};

const len = (v?: string | null) => (v ?? "").trim().length;
const count = (v?: unknown[] | null) => (Array.isArray(v) ? v.length : 0);

export function runShowcaseAudit(t: ShowcaseInput): AuditCheck[] {
  const c = (
    id: string,
    axis: AuditAxis,
    label: string,
    hint: string,
    weight: number,
    passed: boolean,
    severity: AuditSeverity = "warning",
  ): AuditCheck => ({ id, axis, label, hint, weight, passed, severity });

  return [
    // --- Visibilité (SEO / IA) ---
    c("bio_length", "visibilite", "Biographie ≥ 300 caractères",
      "Une fiche de moins de 300 caractères est jugée « contenu mince » et n'est pas indexée.",
      20, len(t.bio) >= 300, "critical"),
    c("short_bio", "visibilite", "Accroche renseignée",
      "L'accroche sert de résumé dans les listes et les extraits de recherche.",
      8, len(t.short_bio) >= 60),
    c("meta", "visibilite", "Titre et description SEO",
      "Sans meta description, Google génère un extrait arbitraire.",
      10, len(t.meta_title) >= 20 && len(t.meta_description) >= 80),
    c("specialties", "visibilite", "Au moins 2 spécialités",
      "Les spécialités rattachent la fiche aux pages canton × spécialité.",
      12, count(t.specialties) >= 2, "critical"),
    c("geo", "visibilite", "Ville, canton et coordonnées",
      "Sans géolocalisation, la fiche n'apparaît ni sur la carte ni dans les recherches locales.",
      12, len(t.city) > 0 && len(t.canton) > 0 && t.latitude != null && t.longitude != null, "critical"),
    c("languages", "visibilite", "Langues de consultation",
      "Les langues déclarées alimentent le balisage knowsLanguage.",
      6, count(t.languages) >= 1),
    c("photo", "visibilite", "Photo de profil",
      "La photo est l'image sociale de la fiche (partages, aperçus).",
      10, len(t.photo_url) > 0, "critical"),
    c("credentials", "visibilite", "Certification vérifiée",
      "Une certification vérifiée est balisée en hasCredential — un signal de confiance fort.",
      6, (t.certificationsVerified ?? 0) > 0, "info"),

    // --- Conversion ---
    c("price", "conversion", "Tarif indiqué",
      "L'absence de tarif est la première cause d'abandon avant contact.",
      14, t.price_min != null, "critical"),
    c("modes", "conversion", "Modes de consultation",
      "Cabinet, visio ou domicile : le visiteur doit savoir comment vous voir.",
      10, count(t.consultation_modes) >= 1),
    c("availability", "conversion", "Disponibilités publiées",
      "Sans créneau, le module de réservation reste vide.",
      16, (t.availabilitiesCount ?? 0) > 0, "critical"),
    c("booking_note", "conversion", "Message de réservation",
      "Un mot d'accueil personnalisé augmente le taux de prise de rendez-vous.",
      6, len(t.booking_note) > 0, "info"),
    c("reviews", "conversion", "Au moins un avis publié",
      "Les avis affichés sont la preuve sociale la plus lue.",
      12, (t.reviewsCount ?? 0) > 0),
    c("gallery", "conversion", "Photos du cabinet",
      "Voir le lieu rassure avant une première séance.",
      6, count(t.gallery_urls) > 0, "info"),
    c("verified", "conversion", "Profil vérifié par Holiswiss",
      "Le badge vérifié est un différenciateur direct dans les listes.",
      6, !!t.verified, "info"),
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
