export const NEWSLETTER_STATUSES = [
  "idee",
  "brief_cree",
  "brouillon",
  "en_revision",
  "approuvee",
  "programmee",
  "envoi_en_cours",
  "envoyee",
  "echec",
  "archivee",
] as const;

export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

export const NEWSLETTER_STATUS_LABELS: Record<NewsletterStatus, string> = {
  idee: "Idée",
  brief_cree: "Brief créé",
  brouillon: "Brouillon",
  en_revision: "En révision",
  approuvee: "Approuvée",
  programmee: "Programmée",
  envoi_en_cours: "Envoi en cours",
  envoyee: "Envoyée",
  echec: "Échec",
  archivee: "Archivée",
};

export const NEWSLETTER_STATUS_DESCRIPTIONS: Record<NewsletterStatus, string> = {
  idee: "Sujet proposé, aucun brief finalisé.",
  brief_cree: "Le sujet possède un brief éditorial mais aucun contenu final.",
  brouillon: "Le contenu est en cours de rédaction ou de modification.",
  en_revision: "Le contenu est prêt à être relu par l'administrateur.",
  approuvee: "L'administrateur a validé le contenu pour l'envoi.",
  programmee: "La newsletter est approuvée et prévue pour une date future.",
  envoi_en_cours: "Resend traite l'envoi.",
  envoyee: "L'envoi a été déclenché. La livraison doit être vérifiée séparément.",
  echec: "L'envoi n'a pas abouti ou a rencontré une erreur.",
  archivee: "La newsletter n'est plus dans la liste active mais reste consultable.",
};

export const NEWSLETTER_LANGS = ["fr", "de", "it", "en"] as const;
export type NewsletterLang = (typeof NEWSLETTER_LANGS)[number];

export const NEWSLETTER_LANG_LABELS: Record<NewsletterLang, string> = {
  fr: "Français",
  de: "Allemand",
  it: "Italien",
  en: "Anglais",
};

/** Piliers éditoriaux de « La Lettre Holiswiss » (destinée aux thérapeutes). */
export const NEWSLETTER_PILLARS = [
  "Développer sa pratique",
  "Visibilité",
  "Gestion du cabinet",
  "Lancement d'activité",
  "Accompagnement numérique",
  "Voix d'experts",
  "Actualités Holiswiss",
] as const;

/** Publics cibles éditoriaux (le segment d'envoi réel viendra plus tard). */
export const NEWSLETTER_AUDIENCES = [
  "Tous les thérapeutes abonnés",
  "Nouveaux thérapeutes",
  "Thérapeutes récemment formés",
  "Profils incomplets",
  "Thérapeutes intéressés par la visibilité",
  "Thérapeutes intéressés par la gestion",
  "Thérapeutes inactifs",
] as const;

export const NEWSLETTER_TONES = [
  "Pédagogique",
  "Pratique",
  "Inspirant",
  "Direct",
  "Rassurant",
] as const;

/** Checklist de contrôle qualité — validation humaine avant tout envoi. */
export const NEWSLETTER_QC_ITEMS = [
  { key: "audience", label: "Le contenu s'adresse aux thérapeutes." },
  { key: "subject_clear", label: "Le sujet est clair." },
  { key: "value", label: "Le contenu apporte une valeur concrète." },
  { key: "facts", label: "Les informations Holiswiss sont exactes." },
  { key: "links", label: "Les liens ont été vérifiés." },
  { key: "cta", label: "L'appel à l'action est cohérent." },
  { key: "resource_preview", label: "La page ressource a été prévisualisée." },
  { key: "unsubscribe", label: "Le lien de désinscription est prévu." },
  { key: "no_client_promise", label: "Le contenu ne promet pas de nouveaux clients." },
  { key: "no_diagnosis", label: "Le contenu ne contient pas de diagnostic." },
  { key: "no_medical_promise", label: "Le contenu ne contient pas de promesse médicale." },
  { key: "proofread", label: "Le contenu a été relu par l'administrateur." },
] as const;

export type NewsletterQcKey = (typeof NEWSLETTER_QC_ITEMS)[number]["key"];

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export type NewsletterIssue = {
  id: string;
  title: string;
  problem: string | null;
  objective: string | null;
  audience: string | null;
  pillar: string | null;
  tone: string | null;
  feature_highlight: string | null;
  cta: string | null;
  lang: string;
  target_date: string | null;
  internal_notes: string | null;
  status: NewsletterStatus;
  created_at: string;
  updated_at: string;
  created_by_email: string | null;
  email_subject: string | null;
  email_preheader: string | null;
  email_intro: string | null;
  email_body: string | null;
  email_button_label: string | null;
  email_button_url: string | null;
  email_footer: string | null;
  resource_title: string | null;
  resource_intro: string | null;
  resource_body: string | null;
  resource_sections: string | null;
  resource_example: string | null;
  resource_checklist: string | null;
  resource_takeaway: string | null;
  resource_cta: string | null;
  slug: string | null;
  published_at: string | null;
  seo_title: string | null;
  meta_description: string | null;
  share_image_url: string | null;
  canonical_url: string | null;
  qc_checklist: Record<string, boolean> | null;
  feature_key: string | null;
  target_route: string | null;
  action_label: string | null;
  action_difficulty: string | null;
  action_minutes: number | null;
  linked_article_id: string | null;
  linked_article_kind: string | null;
  linked_resource_slug: string | null;
  segment_key: string | null;
  connection_priority: string | null;
  connection_notes: string | null;
};

export type NewsletterRevision = {
  id: string;
  action: string;
  status: string | null;
  comment: string | null;
  actor_email: string | null;
  created_at: string;
};
