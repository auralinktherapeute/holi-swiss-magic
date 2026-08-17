// Modèles de départ pour « La Lettre Holiswiss ».
// Ils ne font que pré-remplir les champs de l'éditeur : aucun second
// système de rendu, l'email reste produit par renderNewsletterEmail().

export type NewsletterTemplate = {
  id: string;
  label: string;
  hint: string;
  values: {
    email_subject: string;
    email_preheader: string;
    email_intro: string;
    email_body: string;
    email_button_label: string;
    email_button_url: string;
  };
};

/**
 * Dans le corps de l'email, une ligne de la forme « Titre :: description »
 * est rendue sous forme de carte « nouveauté ». Les autres lignes restent
 * des paragraphes normaux.
 */
export const NEWSLETTER_TEMPLATES: NewsletterTemplate[] = [
  {
    id: "nouveautes",
    label: "Nouveautés produit",
    hint: "Annonce des dernières évolutions de la plateforme, une carte par nouveauté.",
    values: {
      email_subject: "Les nouveautés Holiswiss de ce mois",
      email_preheader: "Score de visibilité, accès fondateur, vitrine professionnelle.",
      email_intro:
        "Bonjour,\n\nVoici les évolutions récentes de Holiswiss qui concernent directement votre fiche et votre visibilité.",
      email_body:
        "Score de visibilité :: Votre tableau de bord affiche désormais un score détaillé de votre fiche, réparti en 8 catégories, avec des recommandations concrètes et le suivi de votre progression.\n\nAccès fondateur :: Les 70 premiers thérapeutes inscrits conservent à vie l'accès au scoring avancé, avec un numéro de place attribué définitivement.\n\nVitrine professionnelle :: Badges de confiance, certifications vérifiées et balisage enrichi pour être mieux repéré par Google et les moteurs de réponse IA.\n\nVos outils de gestion :: Forfaits de séances, questionnaires clients et facturation suisse avec QR-code sont disponibles depuis votre tableau de bord.",
      email_button_label: "Voir mon score de visibilité",
      email_button_url: "https://holiswiss.ch/dashboard/visibilite",
    },
  },
];
