/** Où corriger chaque contrôle de vitrine, dans le tableau de bord. */
export const SHOWCASE_ACTIONS: Record<string, { to: string; cta: string }> = {
  bio_length: { to: "/dashboard/profil", cta: "Compléter ma biographie" },
  short_bio: { to: "/dashboard/profil", cta: "Écrire mon accroche" },
  meta: { to: "/dashboard/profil", cta: "Renseigner titre et description SEO" },
  specialties: { to: "/dashboard/profil", cta: "Ajouter mes spécialités" },
  geo: { to: "/dashboard/profil", cta: "Compléter mon adresse" },
  languages: { to: "/dashboard/profil", cta: "Déclarer mes langues" },
  photo: { to: "/dashboard/profil", cta: "Ajouter ma photo" },
  credentials: { to: "/dashboard/profil", cta: "Déposer une certification" },
  price: { to: "/dashboard/profil", cta: "Indiquer mon tarif" },
  modes: { to: "/dashboard/profil", cta: "Choisir mes modes de consultation" },
  availability: { to: "/dashboard/agenda", cta: "Publier mes disponibilités" },
  booking_note: { to: "/dashboard/profil", cta: "Écrire mon message d'accueil" },
  reviews: { to: "/dashboard/avis", cta: "Inviter mes clients à témoigner" },
  gallery: { to: "/dashboard/profil", cta: "Ajouter des photos du cabinet" },
  verified: { to: "/dashboard/profil", cta: "Compléter mon profil pour la vérification" },
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
