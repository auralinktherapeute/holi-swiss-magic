# Données structurées (JSON-LD) — Holiswiss

**Lis d'abord `.agents/product-marketing.md`.**

Pour un annuaire, le balisage n'est pas un bonus technique : c'est ce qui permet à Google et
aux moteurs IA de comprendre **qu'une fiche est une personne réelle, exerçant un métier, à un
endroit donné**. C'est un critère direct du score de citabilité IA.

## Règle absolue

**Le JSON-LD ne doit jamais affirmer ce que la page n'affiche pas.** Un balisage qui annonce une
note moyenne absente du contenu visible est une infraction aux consignes Google et une raison de
défiance pour un moteur IA. Cohérence stricte entre balisage et affichage.

## Fiche thérapeute — `/{lang}/therapeute/{slug}`

Type : **`Person`** + `jobTitle`, avec `worksFor` vers l'organisation.
`LocalBusiness` seulement si le praticien a un cabinet avec adresse publique et horaires.

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Prénom Nom",
  "jobTitle": "Naturopathe",
  "url": "https://holiswiss.ch/fr/therapeute/{slug}",
  "image": "…",
  "description": "≤ 300 caractères, repris de la bio visible",
  "knowsLanguage": ["fr-CH", "de-CH"],
  "address": { "@type": "PostalAddress", "addressLocality": "Lausanne",
               "addressRegion": "VD", "addressCountry": "CH" },
  "areaServed": { "@type": "AdministrativeArea", "name": "Canton de Vaud" },
  "worksFor": { "@type": "Organization", "name": "Holiswiss", "url": "https://holiswiss.ch" }
}
```

- `aggregateRating` **uniquement** s'il existe des avis validés affichés sur la page
- `hasCredential` pour ASCA / RME / EMR — un signal de confiance fort dans ce secteur
- `priceRange` à partir de `price_min` / `price_max` si renseignés

## Page canton × spécialité

`ItemList` des praticiens + `FAQPage` pour le bloc de questions.
La `FAQPage` est le balisage le plus rentable du site : c'est celui que les moteurs IA extraient.

## Article de blog

`Article` (ou `BlogPosting`) avec `datePublished`, `dateModified`, `author`, `inLanguage`,
`publisher`. Ajouter `FAQPage` si l'article contient un bloc de questions.

⚠️ `dateModified` doit refléter une **vraie** modification. Le rafraîchir sans toucher au
contenu est une manipulation détectée et sanctionnée.

## Site

`Organization` + `WebSite` avec `SearchAction`, `inLanguage: ["fr-CH","de-CH","it-CH","en"]`,
et `sameAs` vers les réseaux sociaux réellement actifs.

## Multilingue

Un JSON-LD par langue, `inLanguage` correct, et `hreflang` réciproque entre les 4 versions.
Erreur fréquente : le même balisage servi sur les 4 langues avec un texte traduit.

## Vérification

1. Rich Results Test (Google) et validator.schema.org
2. **Relire le texte visible** et confirmer que chaque affirmation du balisage y figure
3. Vérifier le rendu SSR : si le JSON-LD n'est injecté que côté client, les crawlers IA ne le
   verront pas — c'est le piège classique d'une application React

## Interdits

- ❌ `aggregateRating` sans avis affichés
- ❌ `MedicalBusiness` ou `Physician` — Holiswiss n'héberge pas de médecins ; ce serait trompeur
  et juridiquement risqué
- ❌ Toute allégation thérapeutique dans `description`
- ❌ Balisage d'éléments invisibles pour l'utilisateur
