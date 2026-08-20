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
  {
    key: "sans_photo",
    label: "Thérapeutes sans photo",
    description: "Profil actif sans photo de profil.",
  },
  {
    key: "sans_presentation",
    label: "Thérapeutes sans présentation",
    description: "Profil actif sans texte de présentation.",
  },
  {
    key: "sans_prestations",
    label: "Thérapeutes sans prestations",
    description: "Aucune prestation renseignée sur le profil.",
  },
  {
    key: "sans_tarifs",
    label: "Thérapeutes sans tarifs",
    description: "Aucun tarif indiqué sur le profil.",
  },
  {
    key: "sans_disponibilite",
    label: "Thérapeutes sans disponibilité",
    description: "Aucune plage de disponibilité déclarée dans l'agenda.",
  },
  {
    key: "sans_contenu_expert",
    label: "Thérapeutes sans contenu expert",
    description: "Aucun article publié dans Voix d'experts.",
  },
  {
    key: "score_faible",
    label: "Score de visibilité faible",
    description: "Santé du profil inférieure à 50 points.",
  },
  {
    key: "selection_manuelle",
    label: "Sélection manuelle (CRM thérapeutes)",
    description:
      "Vous choisissez les adresses une par une dans la liste des thérapeutes. Les personnes désinscrites restent exclues.",
  },
  {
    key: "profil_non_publie",
    label: "Profil non publié",
    description: "Profil renseigné mais pas encore visible publiquement.",
  },
] as const;

export type NewsletterSegmentKey = (typeof NEWSLETTER_SEGMENTS)[number]["key"];

export const NEWSLETTER_SEGMENT_KEYS = NEWSLETTER_SEGMENTS.map((s) => s.key) as [
  NewsletterSegmentKey,
  ...NewsletterSegmentKey[],
];

export const SEND_STATUSES = [
  "test_sent",
  "approved",
  "sending",
  "sent",
  "partially_failed",
  "failed",
  "cancelled",
] as const;

export type SendStatus = (typeof SEND_STATUSES)[number];

export const SEND_STATUS_LABELS: Record<SendStatus, string> = {
  test_sent: "Test envoyé",
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
