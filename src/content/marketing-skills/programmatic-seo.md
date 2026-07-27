# SEO programmatique — canton × spécialité (Holiswiss)

**Lis d'abord `.agents/product-marketing.md`.**

## Le principe

Un annuaire a une structure naturelle : **cantons/villes × spécialités**. Chaque combinaison
correspond à une recherche réelle (*« naturopathe Genève »*, *« Akupunktur Zürich »*) et mérite
une page dédiée. C'est le modèle qui a fait la croissance de tous les annuaires.

## ✅ L'infrastructure existe déjà — ne pas la reconstruire

*(Correction du 27/07/2026 : une version antérieure de cette compétence affirmait que la
taxonomie était un prérequis bloquant. C'était faux — vérifié en base.)*

Le nécessaire est **déjà en place et peuplé** :

| Objet | État |
|---|---|
| `specialty_families` | familles de spécialités |
| `specialties` | **31 actives**, `slug` + `slug_de`, noms et descriptions en 4 langues |
| `therapist_specialties` | table de liaison **normalisée** (N-N) |
| Routes | `/{lang}/specialites/{slug}` et `/{lang}/specialites/{slug}/{ville}` |
| Sitemap | **~208 URL** générées, avec seuil : une page ville×spécialité n'existe que s'il y a au moins un praticien actif |

⚠️ Ne pas confondre avec `therapists.specialties[]`, un champ **texte libre** servant à
l'affichage sur la fiche. La source de vérité pour le SEO est la table `specialties` via la
liaison — c'est elle qu'il faut interroger.

**Slugs localisés :** `slug_de` existe et couvre les 17 spécialités dont le terme allemand
diffère (`naturheilkunde`, `akupunktur`, `bachblueten`…). Les 14 autres portent le même mot
et retombent sur `slug`. Le titre et la description viennent de `pickI18n()`, jamais du slug.

## Ce qui bloque réellement aujourd'hui

Ce n'est plus la technique — c'est le **contenu et l'audience** :

1. **Aucune de ces 208 URL n'est indexée** (« unknown to Google »). Voir `marketing/plan-visibilite.md`.
2. **Un seul praticien en Suisse alémanique** (Bâle). Une page « Akupunktur in Zürich »
   parfaitement optimisée mais vide déçoit le visiteur, et Google mesure cette déception.
   **Le SEO est en avance sur le recrutement : le prochain gain est côté praticiens.**

## L'écueil du contenu creux

Avec **10 thérapeutes sur 4 cantons**, générer 26 × 40 = 1 040 pages donnerait ~1 036 pages
vides. Google les déclasserait et l'ensemble du domaine en pâtirait.

**Règle de seuil :**

| Fiches sur la combinaison | Décision |
|---|---|
| **≥ 3** | Page complète, indexable |
| **1–2** | Page publiée mais `noindex`, avec contenu éditorial pour compenser |
| **0** | **Aucune page.** Rediriger vers la page canton ou la page spécialité |

Le maillage s'ouvre au fur et à mesure que l'annuaire se remplit. C'est un système qui grandit,
pas un lot à publier d'un coup.

## Hiérarchie des pages

```
/{lang}/therapeutes                          ← toutes les fiches
/{lang}/therapeutes/{canton}                 ← 26 pages (toujours valables : contenu cantonal)
/{lang}/therapeutes/{specialite}             ← ~35 pages (toujours valables : contenu métier)
/{lang}/therapeutes/{canton}/{specialite}    ← seulement si ≥ 3 fiches
```

Les deux niveaux intermédiaires sont **toujours** publiables : ils portent du contenu éditorial
(le métier, le canton) même sans beaucoup de fiches.

## Ce que contient une page, au-delà de la liste

Une liste de fiches ne suffit pas à se positionner. Chaque page a besoin de **300+ mots uniques** :

1. **H1** : « [Spécialité] à [Canton] — praticiens vérifiés »
2. **Intro** (80 mots) : la pratique, son intérêt, son contexte dans ce canton
3. **Liste des fiches** avec photo, ville, langues, tarif
4. **Bloc remboursement** : ASCA / RME / EMR, formulation prudente du socle
5. **FAQ locale (3–5 questions)** — c'est ce bloc qui alimente la citabilité IA
   - « Combien coûte une séance de [spécialité] à [Canton] ? »
   - « [Spécialité] est-elle remboursée en Suisse ? »
   - « Comment choisir son praticien à [Ville] ? »
6. **Maillage** : cantons voisins, spécialités proches, articles de blog liés
7. **JSON-LD** : `ItemList` + `FAQPage` (voir compétence `schema`)

⚠️ L'intro et la FAQ doivent **varier réellement** d'une page à l'autre. Un gabarit où seuls
le canton et la spécialité changent est détecté comme du contenu dupliqué.

## Les 4 langues

Chaque page existe en FR/DE/IT/EN avec `hreflang` réciproque. Priorité de déploiement :
**DE d'abord** (62 % de la population, zéro contenu à ce jour), puis FR, IT, EN.

## Ordre de déploiement recommandé

1. Taxonomie des spécialités *(prérequis)*
2. 26 pages canton, en FR puis DE
3. ~35 pages spécialité, FR puis DE
4. Combinaisons canton × spécialité au seuil de 3 fiches
5. IT et EN quand FR/DE sont stabilisées

## Mesure

Suivre par modèle de page : impressions, position moyenne, taux de clic (Search Console), et
citations IA. Une page qui n'a aucune impression après 3 mois doit être fusionnée ou retirée —
mieux vaut 40 pages vivantes que 400 fantômes.
