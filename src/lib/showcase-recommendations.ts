/**
 * Recommandations personnalisées, dérivées des contrôles réels du thérapeute.
 * Module pur : aucune I/O. Une recommandation = un contrôle non validé,
 * formulé en langage naturel, avec son importance, sa catégorie, le gain
 * possible, le lien de correction et son statut.
 *
 * Règle : on ne recommande jamais une information non pertinente pour la
 * pratique du thérapeute (voir `NOT_ACTIONABLE` et `isRelevant`).
 */
import {
  AUDIT_CATEGORY_LABEL,
  type AuditCategory,
  type AuditCheck,
  type AuditSeverity,
} from "@/lib/showcase-audit";
import { SHOWCASE_ACTIONS, type ShowcaseAction } from "@/lib/showcase-actions";

export type RecommendationImportance = "essentiel" | "important" | "conseille";
export type RecommendationStatus = "a_traiter" | "resolu";

export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  importance: RecommendationImportance;
  importanceLabel: string;
  category: AuditCategory;
  categoryLabel: string;
  /** Points gagnés sur 100 si le point est corrigé (ou déjà acquis). */
  gain: number;
  action: ShowcaseAction | null;
  status: RecommendationStatus;
  /** Date à laquelle le point est devenu conforme, si connue. */
  resolvedAt: string | null;
};

const IMPORTANCE: Record<AuditSeverity, { key: RecommendationImportance; label: string }> = {
  critical: { key: "essentiel", label: "Essentiel" },
  warning: { key: "important", label: "Important" },
  info: { key: "conseille", label: "Conseillé" },
};

export const IMPORTANCE_RANK: Record<RecommendationImportance, number> = {
  essentiel: 0,
  important: 1,
  conseille: 2,
};

/** Contrôles gérés automatiquement par la plateforme : rien à demander au thérapeute. */
const NOT_ACTIONABLE = new Set(["hreflang", "canonical"]);

/** Titre et explication rédigés, en langage clair, par contrôle. */
const COPY: Record<string, { title: string; explanation: string; done: string }> = {
  identity: {
    title: "Complétez votre identité professionnelle",
    explanation:
      "Votre nom ou votre intitulé de pratique n'est pas complet : c'est la première chose lue par un visiteur et par les moteurs de recherche.",
    done: "Votre identité professionnelle est complète.",
  },
  photo: {
    title: "Ajoutez une photo de vous",
    explanation:
      "Votre fiche n'a pas encore de portrait. C'est l'élément le plus regardé avant une première prise de contact, et l'image utilisée lors des partages.",
    done: "Votre portrait est en ligne.",
  },
  bio_length: {
    title: "Développez votre présentation",
    explanation:
      "Votre présentation est trop courte pour être indexée : en dessous de 300 caractères, elle est considérée comme un contenu insuffisant.",
    done: "Votre présentation est assez développée pour être indexée.",
  },
  specialties: {
    title: "Précisez vos méthodes et approches",
    explanation:
      "Moins de deux approches sont déclarées. Ce sont elles qui rattachent votre fiche aux pages de recherche par spécialité et par canton.",
    done: "Vos méthodes sont déclarées et rattachent votre fiche aux recherches par spécialité.",
  },
  short_bio: {
    title: "Indiquez le public que vous accompagnez",
    explanation:
      "Votre accroche ne dit pas encore à qui vous vous adressez. Elle est affichée dans les listes de résultats, avant même votre présentation.",
    done: "Le public que vous accompagnez est indiqué dans votre accroche.",
  },
  pro_badge: {
    title: "Obtenez le badge Pro Holiswiss",
    explanation:
      "Votre fiche n'affiche pas encore de badge de distinction. Le badge Pro met votre profil en avant dans les listes de résultats.",
    done: "Votre fiche affiche un badge de distinction Holiswiss.",
  },
  credentials: {
    title: "Faites vérifier une certification",
    explanation:
      "Aucune certification vérifiée n'est rattachée à votre profil. Une certification validée est affichée comme preuve de qualification.",
    done: "Une certification vérifiée est rattachée à votre profil.",
  },
  ide_verified: {
    title: "Vérifiez votre identifiant professionnel",
    explanation:
      "Votre numéro professionnel n'est pas encore vérifié. Cette vérification atteste de votre existence légale en Suisse.",
    done: "Votre identifiant professionnel est vérifié.",
  },
  training: {
    title: "Renseignez votre formation",
    explanation:
      "Ni formation ni années d'expérience ne figurent sur votre fiche : ce sont les informations les plus consultées après votre présentation.",
    done: "Votre parcours de formation est renseigné.",
  },
  reviews: {
    title: "Recueillez un premier avis",
    explanation:
      "Aucun avis authentifié n'est publié. Les témoignages de clients sont l'élément de réassurance le plus lu de votre fiche.",
    done: "Des avis authentifiés sont publiés sur votre fiche.",
  },
  services: {
    title: "Détaillez vos prestations",
    explanation:
      "Vos prestations ne sont pas listées : le visiteur ne peut pas savoir ce que vous proposez concrètement avant de vous écrire.",
    done: "Vos prestations sont détaillées.",
  },
  durations: {
    title: "Indiquez la durée de vos séances",
    explanation:
      "La durée des séances n'est pas précisée. C'est l'une des questions les plus fréquentes avant une réservation.",
    done: "La durée de vos séances est précisée.",
  },
  price: {
    title: "Affichez vos tarifs",
    explanation:
      "Aucun tarif n'est indiqué. L'absence de prix est la première cause d'abandon avant une prise de contact.",
    done: "Vos tarifs sont affichés.",
  },
  availability: {
    title: "Publiez vos disponibilités",
    explanation:
      "Aucun créneau n'est publié : votre module de réservation reste vide et le visiteur ne peut pas réserver.",
    done: "Vos disponibilités sont publiées.",
  },
  modes: {
    title: "Complétez vos informations de consultation",
    explanation:
      "Votre page indique votre méthode, mais pas encore si les séances ont lieu en cabinet, en ligne ou selon les deux modalités.",
    done: "Vos modalités de consultation sont indiquées.",
  },
  contact: {
    title: "Ajoutez un moyen de contact",
    explanation:
      "Ni téléphone ni adresse e-mail publique ne sont renseignés. Une partie des visiteurs préfère ce canal à la réservation en ligne.",
    done: "Un moyen de contact direct est disponible sur votre fiche.",
  },
  city: {
    title: "Renseignez votre ville",
    explanation:
      "Votre ville n'est pas indiquée : c'est le premier critère des recherches de type « thérapeute à … ».",
    done: "Votre ville est renseignée.",
  },
  canton: {
    title: "Renseignez votre canton",
    explanation:
      "Le canton n'est pas indiqué. Il conditionne votre présence sur les pages régionales et dans les filtres de recherche.",
    done: "Votre canton est renseigné.",
  },
  address: {
    title: "Précisez votre adresse ou votre zone d'intervention",
    explanation:
      "Aucune adresse ni zone d'intervention n'est renseignée : votre fiche ne peut pas être positionnée sur la carte.",
    done: "Votre localisation est précisée.",
  },
  geo_consistency: {
    title: "Vérifiez la cohérence de vos informations locales",
    explanation:
      "Ville, canton et coordonnées ne concordent pas encore. Tant qu'elles divergent, votre fiche est écartée des recherches locales.",
    done: "Vos informations géographiques sont cohérentes.",
  },
  google_business: {
    title: "Reliez votre fiche Google Business Profile",
    explanation:
      "Votre fiche Google n'est pas reliée. Le lien renforce la cohérence de vos informations locales entre les deux plateformes.",
    done: "Votre fiche Google Business Profile est reliée.",
  },
  canton_language: {
    title: "Proposez la langue principale de votre canton",
    explanation:
      "La langue officielle de votre canton ne figure pas parmi vos langues de consultation, alors que la majorité des recherches locales s'y font.",
    done: "Vous couvrez la langue principale de votre canton.",
  },
  languages: {
    title: "Déclarez vos langues de consultation",
    explanation:
      "Aucune langue n'est déclarée : les visiteurs ne savent pas dans quelle langue se déroule une séance.",
    done: "Vos langues de consultation sont déclarées.",
  },
  localized_version: {
    title: "Ajoutez une seconde langue de consultation",
    explanation:
      "Vous ne déclarez qu'une seule langue. En ajouter une seconde ouvre votre fiche aux visiteurs des cantons voisins.",
    done: "Vous proposez plusieurs langues de consultation.",
  },
  meta_title: {
    title: "Rédigez le titre de recherche de votre fiche",
    explanation:
      "Votre titre SEO est absent ou trop court : c'est le texte cliquable affiché dans les résultats de recherche.",
    done: "Le titre de recherche de votre fiche est rédigé.",
  },
  meta_description: {
    title: "Rédigez la description de recherche",
    explanation:
      "Sans description, Google compose lui-même un extrait de votre page, souvent hors sujet.",
    done: "Votre description de recherche est rédigée.",
  },
  h1: {
    title: "Complétez le titre principal de votre page",
    explanation:
      "Le titre principal de votre fiche reprend votre nom : il est incomplet tant que votre identité ne l'est pas.",
    done: "Le titre principal de votre page est complet.",
  },
  structured_data: {
    title: "Complétez les champs lus par les moteurs IA",
    explanation:
      "Le balisage de votre fiche est incomplet : nom, ville et spécialité doivent tous être renseignés pour qu'il soit valide.",
    done: "Le balisage structuré de votre fiche est complet.",
  },
  alt_text: {
    title: "Complétez les informations décrivant votre photo",
    explanation:
      "La description de votre photo est générée à partir de votre nom et de votre ville : l'un des deux manque.",
    done: "La description de votre photo est générée correctement.",
  },
  indexable: {
    title: "Publiez votre fiche",
    explanation:
      "Votre fiche n'est pas encore publiée : tant qu'elle ne l'est pas, elle reste invisible pour les moteurs de recherche.",
    done: "Votre fiche est publiée et indexable.",
  },
  faq: {
    title: "Rédigez vos questions fréquentes",
    explanation:
      "Votre fiche ne répond pas encore aux questions habituelles (déroulé d'une séance, première consultation). Ces réponses sont la source privilégiée des assistants IA.",
    done: "Vos questions fréquentes sont renseignées.",
  },
  articles: {
    title: "Publiez un article dans Voix d'experts",
    explanation:
      "Vous n'avez pas encore publié d'article. Chaque publication crée une page supplémentaire qui renvoie vers votre fiche.",
    done: "Vous avez publié dans Voix d'experts.",
  },
  author: {
    title: "Complétez votre profil d'auteur",
    explanation:
      "Vos contenus doivent être signés par un profil complet — nom, titre et photo — pour être crédités correctement.",
    done: "Votre profil d'auteur est complet.",
  },
  method_explained: {
    title: "Expliquez votre méthode plus en détail",
    explanation:
      "Votre présentation reste succincte. Un texte plus développé permet d'expliquer concrètement le déroulé de votre accompagnement.",
    done: "Votre méthode est expliquée en détail.",
  },
  gallery: {
    title: "Montrez votre lieu de consultation",
    explanation:
      "Aucune photo du cabinet n'est en ligne. Voir le lieu à l'avance rassure avant une première séance.",
    done: "Des photos de votre lieu de consultation sont en ligne.",
  },
  profile_fresh: {
    title: "Actualisez votre profil",
    explanation:
      "Votre fiche n'a pas été modifiée depuis plus de six mois. Une fiche mise à jour régulièrement est jugée plus active.",
    done: "Votre profil a été mis à jour récemment.",
  },
  price_fresh: {
    title: "Vérifiez vos tarifs",
    explanation:
      "Vos tarifs n'ont pas été revus depuis plus d'un an. Un prix obsolète crée un désaccord au moment du rendez-vous.",
    done: "Vos tarifs sont à jour.",
  },
  availability_fresh: {
    title: "Actualisez vos disponibilités",
    explanation:
      "Vos créneaux datent de plus de trois mois : ils ne reflètent probablement plus votre agenda réel.",
    done: "Vos disponibilités sont à jour.",
  },
  certifications_valid: {
    title: "Mettez à jour une certification expirée",
    explanation:
      "Au moins une de vos certifications a dépassé sa date de validité. Une attestation périmée affaiblit la confiance.",
    done: "Toutes vos certifications sont en cours de validité.",
  },
};

/**
 * Un contrôle est pertinent s'il est actionnable par le thérapeute.
 * Les contrôles techniques gérés par la plateforme ne donnent jamais lieu
 * à une demande.
 */
export function isRelevant(check: Pick<AuditCheck, "id">): boolean {
  return !NOT_ACTIONABLE.has(check.id);
}

/** Checks whose wording is computed by the audit itself (precise missing field). */
const DYNAMIC_COPY = new Set(["identity"]);

export function buildRecommendations(
  checks: Array<AuditCheck & { gain?: number }>,
  resolvedDates: Record<string, string> = {},
): Recommendation[] {
  return checks
    .filter(isRelevant)
    .map((c) => {
      const copy = COPY[c.id];
      const imp = IMPORTANCE[c.severity];
      return {
        id: c.id,
        title: copy?.title ?? c.label,
        explanation: DYNAMIC_COPY.has(c.id)
          ? c.hint
          : c.passed ? (copy?.done ?? c.label) : (copy?.explanation ?? c.hint),
        importance: imp.key,
        importanceLabel: imp.label,
        category: c.category,
        categoryLabel: AUDIT_CATEGORY_LABEL[c.category],
        gain: c.gain ?? 0,
        action: c.passed ? null : (SHOWCASE_ACTIONS[c.id] ?? null),
        status: (c.passed ? "resolu" : "a_traiter") as RecommendationStatus,
        resolvedAt: c.passed ? (resolvedDates[c.id] ?? null) : null,
      };
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "a_traiter" ? -1 : 1;
      return IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance] || b.gain - a.gain;
    });
}
