/**
 * Source unique de vérité du nœud `Organization` de Holiswiss (JSON-LD).
 *
 * Pourquoi un module partagé : l'audit SEO/GEO du 30/08/2026 a relevé que le
 * `publisher` des articles déclarait une *deuxième* Organization, divergente de
 * celle du layout `$lang` (nom « HoliSwiss » vs « Holiswiss », logo différent,
 * pas d'`@id`). Deux nœuds concurrents fragmentent l'entité : Google et les
 * moteurs génératifs choisissent l'un ou l'autre sans règle. Ici, un seul nœud
 * complet, référencé partout ailleurs par son `@id`.
 *
 * Règle absolue : ce fichier ne déclare que des faits **visibles sur le site**
 * (page /impressum pour l'éditeur, l'adresse et le SIREN). Aucune valeur
 * inventée — c'est la règle « visible content only » de Google, et une note
 * ou un profil social non vérifié suffit à disqualifier le balisage.
 */

import type { Lang } from "@/lib/i18n";

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
 * « 9 Impasse Nussbaum, 68300 Saint-Louis, France ».
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
  streetAddress: "9 Impasse Nussbaum",
  postalCode: "68300",
  addressLocality: "Saint-Louis",
  addressCountry: "FR",
} as const;

const WEBSITE_DESCRIPTIONS: Record<Lang, string> = {
  fr: "Annuaire suisse des thérapeutes holistiques et praticiens bien-être — 26 cantons, 4 langues (FR/DE/IT/EN).",
  de: "Schweizer Verzeichnis ganzheitlicher Therapeut:innen und Wellness-Praktizierender — 26 Kantone, 4 Sprachen (FR/DE/IT/EN).",
  it: "Elenco svizzero di terapeuti olistici e professionisti del benessere — 26 cantoni, 4 lingue (FR/DE/IT/EN).",
  en: "Swiss directory of holistic therapists and wellness practitioners — 26 cantons, 4 languages (FR/DE/IT/EN).",
};

/**
 * Le nœud Organization complet — un par langue, calculé par le layout `$lang`
 * (voir `src/routes/$lang.tsx`) à partir du segment de langue de l'URL.
 *
 * Seul `description` varie avec `lang` : `name`, `slogan`, `knowsAbout`, etc.
 * restent des faits invariants par langue (raison sociale, expertise) — les
 * traduire n'apporterait rien et risquerait de faire diverger l'`@id` fusionné.
 */
export function getOrganizationNode(_lang: Lang) {
  return {
    "@type": "Organization", "@id": ORGANIZATION_ID,
    name: ORGANIZATION_NAME, url: SITE_URL,
    logo: { "@type": "ImageObject", url: LOGO_URL, contentUrl: LOGO_URL, width: LOGO_WIDTH, height: LOGO_HEIGHT, caption: "Logo Holiswiss" },
    email: "contact@holiswiss.ch",
    founder: { "@type": "Person", name: "Gérald Henry" },
    address: LEGAL_ADDRESS,
    areaServed: { "@type": "Country", name: "Switzerland" },
  } as const;
}

/**
 * Le nœud WebSite — un par langue, même logique que `getOrganizationNode`.
 *
 * `potentialAction.target.urlTemplate` pointait toujours vers `/fr/therapeutes`,
 * quelle que soit la langue de la page : le Sitelinks Search Box de Google
 * envoyait donc un visiteur DE/IT/EN chercher en français. `urlTemplate` suit
 * maintenant `lang`.
 */
export function getWebsiteNode(lang: Lang) {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: ORGANIZATION_NAME,
    url: SITE_URL,
    description: WEBSITE_DESCRIPTIONS[lang],
    inLanguage: ["fr-CH", "de-CH", "it-CH", "en"],
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${lang}/therapeutes?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  } as const;
}

/**
 * Le `publisher` à utiliser dans tout nœud Article / BlogPosting.
 *
 * On répète `name` + `logo` plutôt que de ne poser qu'une référence `@id` nue :
 * le Rich Results Test évalue chaque bloc dans le graphe fusionné de la page,
 * mais un bloc autoportant reste valide même si le layout `$lang` change. L'`@id`
 * identique garantit la fusion avec `getOrganizationNode(lang)` — mêmes valeurs,
 * même source, donc aucune divergence possible.
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
