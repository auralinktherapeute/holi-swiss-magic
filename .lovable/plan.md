# Carrousel : choix du nombre de pages et de la présentation

Ajout **additif** dans l'onglet « Propositions » de `/admin/marketing`. Le workflow
demande → proposition → validation → carrousels produits reste identique.

## 1. Base de données (migration additive)

Trois colonnes nullables sur `marketing_proposals`, aucune donnée existante modifiée :

- `carousel_page_count` (int, contrainte 2–5, nullable)
- `carousel_presentation` (texte, contrainte `classic|condensed|storytelling|conversion`, nullable)
- `carousel_generation_version` (int, défaut 1)

Les anciennes propositions restent à `NULL` et continuent de s'afficher exactement comme
aujourd'hui (l'interface affiche seulement une valeur par défaut visuelle : 3 pages · Classique).

## 2. Interface — carte Proposition

Sous la caption, uniquement pour les propositions Instagram au format carrousel et encore
en attente de validation :

```
Nombre de pages :   [ 2 ] [ 3 ] [ 4 ] [ 5 ]
Présentation    :   [ Classique ] [ Condensée ] [ Storytelling ] [ Conversion ]
```

Segmented controls au style existant (violet/cyan), cibles tactiles ≥ 44 px, focus visible.
Les deux réglages sont indépendants. Aucune régénération automatique au clic.

Ajout d'un **aperçu en grille des pages** au format 4:5, chaque page numérotée (`1/3`),
avec l'indicateur « 3 pages · Présentation condensée · FR ». L'aperçu actuel (caption
brute, hashtags, brief visuel) reste en place, l'aperçu pages s'ajoute à côté.

## 3. Régénération

Bouton « Régénérer la proposition », actif seulement si la sélection diffère de ce qui est
enregistré. Confirmation obligatoire : « Voulez-vous régénérer cette proposition avec cette
nouvelle structure ? Le contenu actuel sera remplacé. » Annuler ne change rien.

Nouvelle fonction serveur `regenerateProposalStructure` (admin only, même middleware et même
`assertAdmin` que les fonctions marketing existantes) :

- part de la caption actuelle comme source (sujet, réseau, ton, informations conservés) ;
- demande au modèle exactement N pages, selon la trame imposée par N (2/3/4/5) et le style
  de présentation choisi, pour **les 4 langues déjà présentes** (une langue absente reste absente) ;
- réécrit `caption*`, met à jour les 3 nouvelles colonnes et incrémente
  `carousel_generation_version` ;
- ne touche ni au statut, ni aux hashtags, ni au brief visuel, ni à la date ;
- ne publie rien.

Les pages sont stockées dans la caption sous forme de paragraphes séparés par une ligne vide —
le format que `captionToSlides` sait déjà découper.

## 4. Passage en production

`proposalToCarousel` respecte `carousel_page_count` quand la valeur existe (découpe en
exactement N slides) ; sans valeur, comportement actuel inchangé. Rien d'autre ne bouge dans
l'onglet « Carrousels », l'archivage ni l'export PNG.

## 5. Fichiers touchés

- nouvelle migration SQL
- `src/lib/marketing.functions.ts` (colonnes lues) + nouvelle fn de régénération
- `src/routes/admin.marketing.tsx` (bloc ajouté dans `ProposalCard`)
- `src/lib/proposal-carousel.ts` (respect du nombre de pages, sinon inchangé)

Rien n'est supprimé ni refactoré.
