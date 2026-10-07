# Étape 6B — performance visuelle et robots

## Périmètre
- Vérifier réellement, en lecture seule, si les images signées peuvent être redimensionnées ; conserver automatiquement l’original en cas d’échec.
- Centraliser les variantes des photos thérapeutes, stabiliser leurs dimensions et éviter les signatures répétées dans un même affichage.
- Réutiliser une seule adresse signée par image d’événement, avec dimensions réservées et priorité uniquement pour l’image principale.
- Générer un logo WebP léger de 128 px et un favicon dérivé du logo, sans remplacer les originaux.
- Ajouter `noindex,nofollow` aux espaces admin et thérapeute, puis compléter `robots.txt` pour les variantes avec ou sans barre finale.
- Stabiliser uniquement les deux zones mesurées sur les pages spécialité et article, sans modifier leur contenu ni la mise en page générale.

## Contrôles
- Tests ciblés : repli image originale, adresse événement unique, attributs d’images, robots privés et favicon.
- Suite complète, vérification TypeScript et compilation automatique de l’aperçu.
- Exploration des 358 adresses, contrôle visuel ordinateur/mobile des sept familles demandées, puis mesures indicatives locales comparées à l’audit 6A.
- Aucun parcours connecté sans session appropriée ; aucune publication, écriture de données, migration, indexation ou action métier.

## Sécurité et retour arrière
- Changements limités aux utilitaires d’images, affichages concernés, métadonnées privées, `robots.txt` et nouveaux fichiers d’image.
- Aucun changement d’accès, de données, de contenu éditorial ou de service externe.
- Retour arrière possible fichier par fichier ; les images originales restent intactes.
