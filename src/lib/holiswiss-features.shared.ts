// Catalogue officiel des fonctionnalités Holiswiss utilisable par « La Lettre Holiswiss ».
// Source unique de vérité pour : CTA, lien principal, contexte transmis à l'agent IA,
// contenu de la page ressource et recommandations envoyées aux thérapeutes.
//
// RÈGLE : `route` doit toujours pointer vers une route RÉELLE du projet.
// Une fonctionnalité pas encore livrée reste `status: "a_configurer"` avec `route: null`.

export type FeatureStatus = "disponible" | "a_configurer";

export type HoliswissFeature = {
  key: string;
  label: string;
  /** Description officielle validée — l'agent IA ne doit jamais en inventer une autre. */
  description: string;
  /** Limites à respecter dans le discours (ce que la fonctionnalité ne fait pas). */
  limits: string;
  /** Route interne réelle (destination du CTA), ou null si la fonctionnalité n'existe pas encore. */
  route: string | null;
  /** Page publique associée, quand elle existe. */
  publicRoute: string | null;
  ctaLabel: string;
  pillar: string;
  status: FeatureStatus;
};

export const HOLISWISS_FEATURES: readonly HoliswissFeature[] = [
  {
    key: "site_pro",
    label: "Site professionnel du thérapeute",
    description:
      "Espace de présentation professionnelle du thérapeute hébergé par Holiswiss, alimenté par les informations de son profil.",
    limits:
      "Module en cours de préparation : aucune page de configuration dédiée n'est encore disponible.",
    route: null,
    publicRoute: null,
    ctaLabel: "Préparer ma présence en ligne",
    pillar: "Visibilité",
    status: "a_configurer",
  },
  {
    key: "profil_public",
    label: "Profil public",
    description:
      "Fiche publique du thérapeute sur Holiswiss : présentation, approches, langues, lieu, tarifs, modes de consultation et moyens de contact.",
    limits: "Le profil se complète depuis le tableau de bord ; sa visibilité dépend de son statut.",
    route: "/dashboard/profil",
    publicRoute: "/fr/therapeutes",
    ctaLabel: "Compléter mon profil",
    pillar: "Visibilité",
    status: "disponible",
  },
  {
    key: "sante_profil",
    label: "Santé du profil",
    description:
      "Score de santé du profil calculé par Holiswiss (complétude, contenu, activité, visibilité) accompagné de recommandations concrètes.",
    limits:
      "Le score est indicatif : il mesure la qualité du profil, il ne garantit aucun résultat commercial.",
    route: "/dashboard",
    publicRoute: null,
    ctaLabel: "Voir la santé de mon profil",
    pillar: "Accompagnement numérique",
    status: "disponible",
  },
  {
    key: "visibilite_google_ia",
    label: "Visibilité Google et IA",
    description:
      "Optimisation des pages Holiswiss pour la recherche (titres, descriptions, balisage structuré) afin que le profil soit compréhensible par Google et les moteurs de réponse IA.",
    limits: "Holiswiss optimise la structure ; aucun positionnement ne peut être garanti.",
    route: "/dashboard/profil",
    publicRoute: null,
    ctaLabel: "Améliorer ma visibilité",
    pillar: "Visibilité",
    status: "disponible",
  },
  {
    key: "agenda",
    label: "Agenda",
    description:
      "Agenda du thérapeute : disponibilités hebdomadaires, périodes bloquées et vue des rendez-vous.",
    limits: "L'agenda ne remplace pas un logiciel de facturation ni un dossier patient.",
    route: "/dashboard/agenda",
    publicRoute: null,
    ctaLabel: "Configurer mon agenda",
    pillar: "Gestion du cabinet",
    status: "disponible",
  },
  {
    key: "reservation",
    label: "Réservation en ligne",
    description:
      "Prise de rendez-vous en ligne depuis le profil public, selon les disponibilités déclarées par le thérapeute.",
    limits: "La réservation dépend des disponibilités saisies dans l'agenda.",
    route: "/dashboard/reservations",
    publicRoute: null,
    ctaLabel: "Activer la réservation en ligne",
    pillar: "Développer sa pratique",
    status: "disponible",
  },
  {
    key: "facturation",
    label: "Facturation",
    description:
      "Création de factures suisses depuis les séances et les forfaits, avec numérotation automatique et export PDF.",
    limits: "Holiswiss ne fournit ni conseil fiscal ni comptabilité.",
    route: "/dashboard/facturation",
    publicRoute: null,
    ctaLabel: "Créer une facture",
    pillar: "Gestion du cabinet",
    status: "disponible",
  },
  {
    key: "qr_facture",
    label: "QR-facture",
    description:
      "Génération de la QR-facture suisse conforme, intégrée aux factures créées dans Holiswiss.",
    limits: "Nécessite un IBAN valide renseigné dans les paramètres de facturation.",
    route: "/dashboard/facturation",
    publicRoute: null,
    ctaLabel: "Configurer ma QR-facture",
    pillar: "Gestion du cabinet",
    status: "disponible",
  },
  {
    key: "twint",
    label: "TWINT",
    description:
      "Ajout de TWINT parmi les moyens de paiement affichés au client lors du règlement d'une facture.",
    limits: "Holiswiss n'encaisse pas les paiements : le règlement se fait directement au thérapeute.",
    route: "/dashboard/facturation",
    publicRoute: null,
    ctaLabel: "Ajouter TWINT",
    pillar: "Gestion du cabinet",
    status: "disponible",
  },
  {
    key: "avis",
    label: "Avis",
    description:
      "Collecte et modération des avis clients, avec possibilité de réponse publique du thérapeute.",
    limits: "Les avis sont modérés ; ils ne peuvent être ni achetés ni supprimés sur simple demande.",
    route: "/dashboard/avis",
    publicRoute: null,
    ctaLabel: "Gérer mes avis",
    pillar: "Développer sa pratique",
    status: "disponible",
  },
  {
    key: "voix_experts",
    label: "Voix d'experts",
    description:
      "Espace éditorial où les thérapeutes publient des articles validés par Holiswiss, visibles publiquement.",
    limits: "Chaque article passe par une validation éditoriale avant publication.",
    route: "/dashboard/articles",
    publicRoute: "/fr/paroles",
    ctaLabel: "Proposer un article",
    pillar: "Voix d'experts",
    status: "disponible",
  },
  {
    key: "accompagnement_numerique",
    label: "Accompagnement numérique",
    description:
      "Parcours guidé qui aide le thérapeute à compléter son profil étape par étape via une checklist d'onboarding.",
    limits:
      "L'accompagnement complet est en cours de construction : seule la checklist d'onboarding est disponible.",
    route: "/dashboard",
    publicRoute: null,
    ctaLabel: "Reprendre mon parcours",
    pillar: "Accompagnement numérique",
    status: "disponible",
  },
  {
    key: "assistant_ia",
    label: "Assistant IA",
    description:
      "Assistant conversationnel destiné à guider le thérapeute dans l'usage de Holiswiss.",
    limits: "Fonctionnalité non livrée : aucune page thérapeute ne lui est encore dédiée.",
    route: null,
    publicRoute: null,
    ctaLabel: "Découvrir l'assistant",
    pillar: "Accompagnement numérique",
    status: "a_configurer",
  },
] as const;

export const FEATURE_KEYS = HOLISWISS_FEATURES.map((f) => f.key);

export function findFeature(key: string | null | undefined): HoliswissFeature | null {
  if (!key) return null;
  return HOLISWISS_FEATURES.find((f) => f.key === key) ?? null;
}

export const ACTION_DIFFICULTIES = ["facile", "moyenne", "avancee"] as const;
export const ACTION_DIFFICULTY_LABELS: Record<string, string> = {
  facile: "Facile",
  moyenne: "Moyenne",
  avancee: "Avancée",
};

export const CONNECTION_PRIORITIES = ["basse", "moyenne", "haute"] as const;
export const PRIORITY_LABELS: Record<string, string> = {
  basse: "Basse",
  moyenne: "Moyenne",
  haute: "Haute",
};

export const SUGGESTION_STATUSES = ["ouverte", "acceptee", "rejetee"] as const;
export const SUGGESTION_STATUS_LABELS: Record<string, string> = {
  ouverte: "Ouverte",
  acceptee: "Acceptée",
  rejetee: "Écartée",
};

export type NewsletterSuggestion = {
  id: string;
  subject: string;
  audience: string | null;
  pillar: string | null;
  feature_key: string | null;
  objective: string | null;
  rationale: string | null;
  priority: string;
  source: string;
  status: string;
  issue_id: string | null;
  created_at: string;
};
