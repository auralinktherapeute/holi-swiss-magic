export const NEWSLETTER_STATUSES = [
  "idee",
  "brouillon",
  "en_revision",
  "approuvee",
  "programmee",
  "envoyee",
  "archivee",
] as const;

export type NewsletterStatus = (typeof NEWSLETTER_STATUSES)[number];

export const NEWSLETTER_STATUS_LABELS: Record<NewsletterStatus, string> = {
  idee: "Idée",
  brouillon: "Brouillon",
  en_revision: "En révision",
  approuvee: "Approuvée",
  programmee: "Programmée",
  envoyee: "Envoyée",
  archivee: "Archivée",
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
  "Visibilité",
  "Structurer son activité",
  "Présence professionnelle",
  "Agenda & CRM",
  "Facturation & organisation numérique",
  "Fonctionnalités Holiswiss",
  "Accompagnement numérique & IA",
] as const;

export const NEWSLETTER_TONES = [
  "Pédagogique",
  "Pratique",
  "Inspirant",
  "Direct",
  "Rassurant",
] as const;

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
};