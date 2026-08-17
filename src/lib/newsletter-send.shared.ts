// Segments d'envoi et statuts techniques de « La Lettre Holiswiss ».
// Partagé client/serveur : aucune dépendance serveur ici.

export const NEWSLETTER_SEGMENTS = [
  {
    key: "tous",
    label: "Tous les thérapeutes consentants",
    description: "Thérapeutes actifs ayant accepté La Lettre Holiswiss.",
  },
  {
    key: "nouveaux",
    label: "Nouveaux thérapeutes (90 jours)",
    description: "Inscription datant de moins de 90 jours.",
  },
  {
    key: "profils_incomplets",
    label: "Profils incomplets",
    description: "Onboarding non terminé.",
  },
  {
    key: "premium",
    label: "Abonnés payants",
    description: "Thérapeutes dont l'abonnement n'est pas gratuit.",
  },
] as const;

export type NewsletterSegmentKey = (typeof NEWSLETTER_SEGMENTS)[number]["key"];

export const NEWSLETTER_SEGMENT_KEYS = NEWSLETTER_SEGMENTS.map((s) => s.key) as [
  NewsletterSegmentKey,
  ...NewsletterSegmentKey[],
];

export const SEND_STATUSES = [
  "approved",
  "sending",
  "sent",
  "partially_failed",
  "failed",
  "cancelled",
] as const;

export type SendStatus = (typeof SEND_STATUSES)[number];

export const SEND_STATUS_LABELS: Record<SendStatus, string> = {
  approved: "Prête",
  sending: "Envoi en cours",
  sent: "Envoyée",
  partially_failed: "Envoi partiel",
  failed: "Échec",
  cancelled: "Annulée",
};

export type NewsletterSendRow = {
  id: string;
  issue_id: string;
  is_test: boolean;
  segment: string;
  version_label: string | null;
  subject: string | null;
  from_address: string | null;
  resource_url: string | null;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  status: SendStatus;
  error_message: string | null;
  actor_email: string | null;
  started_at: string;
  finished_at: string | null;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
