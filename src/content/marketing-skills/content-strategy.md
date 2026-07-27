# Stratégie de contenu — Holiswiss

**Lis d'abord `.agents/product-marketing.md`.**

## Deux audiences, deux contenus — ne jamais les mélanger

| Contenu | Cible | Objectif |
|---|---|---|
| **Blog / SEO** | Le **patient** | Amener du trafic qualifié → prouver la valeur au thérapeute |
| **Réseaux sociaux** | Le **thérapeute** | Recruter des praticiens |
| **Voix d'experts** | Le patient, signé par le thérapeute | Autorité du praticien + contenu frais |

Une seule question à se poser avant d'écrire : *qui lit ça ?* La confusion des deux faces est
l'erreur la plus coûteuse.

## L'état réel du contenu (27/07/2026)

- **38 articles, tous en français.** Zéro en allemand, italien ou anglais.
- 26 catégories : naturopathie (4), ostéopathie (3), bien-être (3), sophrologie, acupuncture,
  lithothérapie, kinésiologie, chromothérapie (2 chacune), et 18 autres à 1 article.

**Le déséquilibre le plus coûteux : la Suisse alémanique représente ~62 % de la population et
ne reçoit aucun contenu.** Avant d'écrire un 39ᵉ article français, traduire et adapter les
10 meilleurs en allemand a un rendement bien supérieur.

## Les 4 familles d'articles

**1. Remboursement & cadre légal** — *la plus rentable, la moins servie*
« [Thérapie] est-elle remboursée en Suisse ? », « ASCA, RME, EMR : quelle différence ? »
Forte anxiété, recherche récurrente, réponses en ligne souvent floues ou fausses.

**2. Choisir un praticien** — mène directement à l'annuaire
« Comment choisir son [spécialité] », « Première séance : à quoi s'attendre »

**3. Comprendre une pratique** — volume, notoriété
« La sophrologie, pour qui et pourquoi ? » — **jamais** de promesse de guérison

**4. Local** — alimente le SEO programmatique
« Où consulter en [canton] », « le bien-être à [ville] »

## Méthode de sélection d'un sujet

1. Existe-t-il déjà un article proche ? (anti-doublon par sujet, pas seulement par slug)
2. Correspond-il à une recherche réelle formulée par un patient ?
3. Peut-on y répondre **factuellement**, sans allégation thérapeutique ?
4. Existe-t-il au moins un thérapeute de cette spécialité sur la plateforme ?
   → sinon l'article génère du trafic qu'on ne convertit pas
5. Quelle langue ? **Par défaut : allemand**, tant que le déséquilibre persiste.

## Structure d'un article

- **Titre** : la question telle qu'on la pose (8–14 mots)
- **Réponse directe dans les 2–3 premières phrases** (citabilité IA)
- 900–1300 mots, sous-titres en questions
- **FAQ finale** de 3–5 questions → `FAQPage` en JSON-LD
- Lien vers les fiches concernées et 2–3 articles liés
- Date de mise à jour visible
- Avertissement de non-substitution à un avis médical

## Interdits

- ❌ « guérit », « soigne », « traite », « remède » → *accompagne, soutient, favorise*
- ❌ Affirmer un remboursement sans la nuance ASCA/RME/EMR + « selon la caisse »
- ❌ Statistique sans source
- ❌ Image hors-sujet — vérifier chaque visuel, ne jamais se fier au mot-clé de recherche seul

## Rythme

Qualité avant volume. Un article juste, daté et bien structuré vaut mieux que trois approximatifs :
le secteur du bien-être souffre déjà d'un déficit de crédibilité, chaque approximation coûte double.
