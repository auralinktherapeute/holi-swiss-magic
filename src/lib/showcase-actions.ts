/** Où corriger chaque contrôle de vitrine, dans le tableau de bord.
 *  `hash` cible l'ancre exacte de la section concernée (voir useHashFocus). */
export type ShowcaseAction = { to: string; hash?: string; cta: string };

export const SHOWCASE_ACTIONS: Record<string, ShowcaseAction> = {
  // ── Profil professionnel ──────────────────────────────────────────────
  identity: { to: "/dashboard/profil", hash: "identite", cta: "Compléter nom et titre" },
  photo: { to: "/dashboard/profil", hash: "photo", cta: "Ajouter ma photo" },
  bio_length: { to: "/dashboard/profil", hash: "presentation", cta: "Compléter ma biographie" },
  short_bio: { to: "/dashboard/profil", hash: "accroche", cta: "Écrire mon accroche" },
  specialties: { to: "/dashboard/profil", hash: "specialites", cta: "Ajouter mes spécialités" },

  // ── Confiance ─────────────────────────────────────────────────────────
  pro_badge: { to: "/dashboard/abonnement", cta: "Découvrir l'offre Pro" },
  credentials: { to: "/dashboard/profil", hash: "certifications", cta: "Déposer une certification" },
  certifications_valid: { to: "/dashboard/profil", hash: "certifications", cta: "Mettre à jour mes certifications" },
  ide_verified: { to: "/dashboard/profil", hash: "ide", cta: "Renseigner mon identifiant professionnel" },
  training: { to: "/dashboard/profil", hash: "experience", cta: "Ajouter ma formation" },
  reviews: { to: "/dashboard/avis", hash: "avis", cta: "Inviter mes clients à témoigner" },
  verified: { to: "/dashboard/profil", hash: "certifications", cta: "Compléter mon profil pour la vérification" },

  // ── Prestations et conversion ─────────────────────────────────────────
  services: { to: "/dashboard/profil", hash: "prestations", cta: "Décrire mes prestations" },
  durations: { to: "/dashboard/profil", hash: "prestations", cta: "Indiquer les durées" },
  price: { to: "/dashboard/profil", hash: "tarifs", cta: "Indiquer mon tarif" },
  price_fresh: { to: "/dashboard/profil", hash: "tarifs", cta: "Actualiser mes tarifs" },
  modes: { to: "/dashboard/profil", hash: "modes", cta: "Choisir mes modes de consultation" },
  contact: { to: "/dashboard/profil", hash: "contact", cta: "Ajouter un moyen de contact" },
  availability: { to: "/dashboard/agenda", hash: "disponibilites", cta: "Publier mes disponibilités" },
  availability_fresh: { to: "/dashboard/agenda", hash: "disponibilites", cta: "Actualiser mes disponibilités" },

  // ── SEO local ─────────────────────────────────────────────────────────
  city: { to: "/dashboard/profil", hash: "localisation", cta: "Renseigner ma ville" },
  canton: { to: "/dashboard/profil", hash: "canton", cta: "Renseigner mon canton" },
  address: { to: "/dashboard/profil", hash: "localisation", cta: "Ajouter mon adresse ou ma zone" },
  geo: { to: "/dashboard/profil", hash: "localisation", cta: "Compléter mon adresse" },
  geo_consistency: { to: "/dashboard/profil", hash: "localisation", cta: "Vérifier mes informations géographiques" },
  google_business: { to: "/dashboard/profil", hash: "liens", cta: "Relier ma fiche Google" },

  // ── Langues ───────────────────────────────────────────────────────────
  languages: { to: "/dashboard/profil", hash: "langues", cta: "Déclarer mes langues" },
  canton_language: { to: "/dashboard/profil", hash: "langues", cta: "Ajouter la langue de mon canton" },
  localized_version: { to: "/dashboard/profil", hash: "langues", cta: "Ajouter une seconde langue" },

  // ── SEO technique ─────────────────────────────────────────────────────
  meta: { to: "/dashboard/profil", hash: "seo", cta: "Renseigner titre et description SEO" },
  meta_title: { to: "/dashboard/profil", hash: "seo-title", cta: "Rédiger mon title SEO" },
  meta_description: { to: "/dashboard/profil", hash: "seo-description", cta: "Rédiger ma meta description" },
  h1: { to: "/dashboard/profil", hash: "identite", cta: "Compléter mon identité" },
  structured_data: { to: "/dashboard/profil", hash: "identite", cta: "Compléter les champs balisés" },
  alt_text: { to: "/dashboard/profil", hash: "photo", cta: "Compléter photo et ville" },
  indexable: { to: "/dashboard/profil", hash: "identite", cta: "Publier ma fiche" },

  // ── Contenu expert ────────────────────────────────────────────────────
  faq: { to: "/dashboard/agenda", hash: "message-accueil", cta: "Rédiger mes questions fréquentes" },
  booking_note: { to: "/dashboard/agenda", hash: "message-accueil", cta: "Écrire mon message d'accueil" },
  articles: { to: "/dashboard/articles", cta: "Publier un article" },
  author: { to: "/dashboard/profil", hash: "identite", cta: "Compléter mon profil d'auteur" },
  method_explained: { to: "/dashboard/profil", hash: "presentation", cta: "Détailler ma méthode" },

  // ── Fraîcheur ─────────────────────────────────────────────────────────
  profile_fresh: { to: "/dashboard/profil", hash: "identite", cta: "Mettre à jour mon profil" },
  gallery: { to: "/dashboard/profil", hash: "photos-cabinet", cta: "Ajouter des photos du cabinet" },
};

export const SHOWCASE_STATUS_LABEL: Record<string, { label: string; message: string }> = {
  a_renforcer: {
    label: "À renforcer",
    message: "Votre vitrine manque encore d'éléments essentiels pour être bien comprise et rassurante.",
  },
  en_bonne_voie: {
    label: "En bonne voie",
    message: "Les bases sont posées : quelques ajouts feront une vraie différence.",
  },
  solide: {
    label: "Solide",
    message: "Vous êtes proche d'un profil très complet.",
  },
  excellent: {
    label: "Excellent",
    message: "Votre vitrine est complète : pensez à la tenir à jour.",
  },
};
