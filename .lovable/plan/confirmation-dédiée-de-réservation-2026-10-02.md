# Confirmation dédiée de réservation

## Objectif
Remplacer le formulaire étroit et la boîte de dialogue actuels par une étape de confirmation plein écran intégrée au profil, sans changer la création de réservation ni la base de données.

## Modifications prévues
- Conserver `BookingWidget` comme propriétaire de la prestation, de la date, de l’heure, des coordonnées et des contrôles de disponibilité.
- Au clic sur un créneau encore disponible, ouvrir l’étape « Coordonnées » dans une grande carte centrée : récapitulatif à gauche, formulaire à droite sur ordinateur, une colonne sur mobile.
- Ajouter l’indicateur « Créneau — Coordonnées — Confirmation », le retour « Modifier le créneau » sans perdre la prestation, et le bouton final exact « Confirmer la réservation ».
- Afficher le thérapeute, la prestation, la date, l’heure, la durée, le tarif et le lieu uniquement à partir des données réelles déjà chargées sur le profil.
- Garder la validation Zod, la relecture fraîche des disponibilités, la protection contre les réponses obsolètes et la contrainte anti-double réservation avant l’insertion existante.
- Afficher les erreurs de nom et d’e-mail près de leurs champs, avec labels visibles, focus clavier et annonce accessible.
- Ajouter les traductions FR/DE/IT/EN nécessaires sans modifier les autres contenus.

## Vérifications
- Tests ciblés : ouverture après sélection, aucune création avant le clic final, retour conservant la prestation, libellé final et structure accessible.
- Tests existants liés aux créneaux et à la réservation.
- Compilation complète.
- Contrôle visuel desktop et mobile dans l’aperçu, sans utiliser de données personnelles réelles.

## Limites de portée
- Aucune migration, aucun changement de schéma, aucune nouvelle fonction serveur.
- Aucun changement des règles de disponibilité ou de réservation.
- Aucune publication.
