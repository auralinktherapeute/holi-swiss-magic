/**
 * Source unique de vérité du nœud `Organization` de Holiswiss (JSON-LD).
 *
 * Pourquoi un module partagé : l'audit SEO/GEO du 30/08/2026 a relevé que le
 * `publisher` des articles déclarait une *deuxième* Organization, divergente de
 * celle du layout racine (nom « HoliSwiss » vs « Holiswiss », logo différent,
 * pas d'`@id`). Deux nœuds concurrents fragmentent l'entité : Google et les
 * moteurs génératifs choisissent l'un ou l'autre sans règle. Ici, un seul nœud
 * complet, référencé partout ailleurs par son `@id`.
 *
 * Règle absolue : ce fichier ne déclare que des faits **visibles sur le site**
 * (page /impressum pour l'éditeur, l'adresse et le SIREN). Aucune valeur
 * inventée — c'est la règle « visible content only » de Google, et une note
 * ou un profil social non vérifié suffit à disqualifier le balisage.
 */

export const SITE_URL = "https://holiswiss.ch";

/** Identifiants stables du graphe — à ne jamais renommer (les nœuds fusionnent dessus). */
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const ORGANIZATION_NAME = "Holiswiss";

/**
 * Logo servi depuis notre propre domaine, en `image/png`.
 *
 * Avant le 30/08/2026 cette URL était déjà `https://holiswiss.ch/logo.png`,
 * mais **aucun fichier n'existait** : le catch-all du routeur répondait 200
 * avec 86 837 octets de HTML. `publisher.logo` était donc cassé sur les
 * 248 articles. Le fichier réel vit maintenant dans `public/logo.png`
 * (lotus Holiswiss, PNG 500 × 500 — le même que dans les e-mails
 * transactionnels), servi en statique avant toute route.
 */
export const LOGO_URL = `${SITE_URL}/logo.png`;
export const LOGO_WIDTH = 500;
export const LOGO_HEIGHT = 500;

/**
 * Profils officiels de la marque, pour `sameAs`.
 *
 * VOLONTAIREMENT VIDE. `sameAs` est le champ qui relie l'entité « Holiswiss »
 * à des sources tierces corroborantes (LinkedIn, Instagram, Wikidata, Crunchbase,
 * registre) ; c'est le principal levier d'autorité d'entité pour les moteurs
 * génératifs. Mais une URL non vérifiée est pire que rien : elle rattache
 * l'entité à un compte qui n'est pas le nôtre.
 *
 * À remplir uniquement avec des comptes **confirmés par Holiswiss**. Les
 * vérifier depuis un script est impossible : X et Instagram renvoient 200 et
 * un mur de connexion pour n'importe quel identifiant, existant ou non.
 * `sameAs` n'est émis que si ce tableau est non vide.
 */
export const SAME_AS: readonly string[] = [];

/**
 * Adresse de l'éditeur, telle qu'elle est **publiée sur /impressum** :
 * « Impasse Nussbaum, 68300 Saint-Louis, Alsace, France ».
 *
 * Holiswiss est exploité depuis la France (entrepreneur individuel) et dessert
 * la Suisse : `address` décrit l'éditeur, `areaServed` décrit le marché. Avant,
 * `address` se réduisait à `{ addressCountry: "CH" }` — ni vrai, ni exploitable.
 *
 * Pour revenir à une adresse minimale, remplacer l'objet ci-dessous par
 * `{ "@type": "PostalAddress", addressCountry: "FR" }`.
 */
export const LEGAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Impasse Nussbaum",
  postalCode: "68300",
  addressLocality: "Saint-Louis",
  addressRegion: "Alsace",
  addressCountry: "FR",
} as const;

/**
 * SIREN 103 987 061, publié sur /impressum. Exprimé aussi en ISO 6523
 * (`iso6523Code`), le format d'identifiant que la documentation Organization de
 * Google cite explicitement : l'ICD `0002` désigne le répertoire SIRENE français.
 * C'est le crochet le plus dur dont dispose un moteur pour réconcilier
 * « Holiswiss » avec un registre officiel.
 */
const SIREN = "103987061";

/** Le nœud Organization complet — déclaré UNE fois, dans le layout racine. */
export const organizationNode = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: ORGANIZATION_NAME,
  alternateName: "HoliSwiss",
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: LOGO_URL,
    contentUrl: LOGO_URL,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
    caption: "Logo Holiswiss",
  },
  image: LOGO_URL,
  description:
    "Plateforme suisse de mise en relation avec des thérapeutes holistiques et praticiens en médecines douces certifiés, dans les 26 cantons et en 4 langues.",
  slogan: "Trouvez le bon thérapeute, partout en Suisse.",
  email: "contact@holiswiss.ch",
  // « Exploitant : Gérald Henry » — /impressum, section « Éditeur du site ».
  founder: { "@type": "Person", name: "Gérald Henry" },
  address: LEGAL_ADDRESS,
  identifier: {
    "@type": "PropertyValue",
    propertyID: "SIREN",
    value: SIREN,
  },
  iso6523Code: `0002:${SIREN}`,
  ...(SAME_AS.length > 0 ? { sameAs: [...SAME_AS] } : {}),
  areaServed: {
    "@type": "Country",
    name: "Switzerland",
    alternateName: ["Suisse", "Schweiz", "Svizzera", "CH"],
  },
  knowsLanguage: ["fr-CH", "de-CH", "it-CH", "en"],
  knowsAbout: [
    "Sophrologie",
    "Hypnose",
    "Naturopathie",
    "Acupuncture",
    "Ostéopathie",
    "Réflexologie",
    "Méditation",
    "Reiki",
    "Kinésiologie",
    "Ayurveda",
    "Médecine douce",
    "Thérapie holistique",
    "Bien-être",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "contact@holiswiss.ch",
    contactType: "customer support",
    availableLanguage: ["French", "German", "Italian", "English"],
    areaServed: "CH",
  },
} as const;

/** Le nœud WebSite, déclaré UNE fois lui aussi, dans le layout racine. */
export const websiteNode = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: ORGANIZATION_NAME,
  url: SITE_URL,
  description:
    "Annuaire suisse des thérapeutes holistiques et praticiens bien-être — 26 cantons, 4 langues (FR/DE/IT/EN).",
  inLanguage: ["fr-CH", "de-CH", "it-CH", "en"],
  publisher: { "@id": ORGANIZATION_ID },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/fr/therapeutes?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
} as const;

/**
 * Le `publisher` à utiliser dans tout nœud Article / BlogPosting.
 *
 * On répète `name` + `logo` plutôt que de ne poser qu'une référence `@id` nue :
 * le Rich Results Test évalue chaque bloc dans le graphe fusionné de la page,
 * mais un bloc autoportant reste valide même si le layout racine change. L'`@id`
 * identique garantit la fusion avec `organizationNode` — mêmes valeurs, même
 * source, donc aucune divergence possible.
 */
export const publisherNode = {
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: ORGANIZATION_NAME,
  url: SITE_URL,
  logo: {
    "@type": "ImageObject",
    url: LOGO_URL,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
} as const;

/** Référence courte vers l'Organization, pour `author` quand l'auteur est la marque. */
export const organizationRef = { "@id": ORGANIZATION_ID } as const;
