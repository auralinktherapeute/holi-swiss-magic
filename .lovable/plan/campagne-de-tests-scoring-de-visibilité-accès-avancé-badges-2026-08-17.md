# Campagne de tests — Scoring de visibilité, accès avancé, badges

## Audit d'intégration (état constaté, avant tout test)

Chaîne unique déjà en place, sans calcul parallèle :
`advanced_scoring_eligibility` (SQL) -> `scoring-access.server.ts` -> `showcase-audit.server.ts`
(`loadShowcaseAudit` + `buildShowcaseReport`) -> `showcase-audit.ts` (8 catégories) ->
`showcase-recommendations.ts` -> UI thérapeute (`dashboard.visibilite.tsx`) et UI admin
(`TherapistScorePanel.tsx` dans `/admin/sante-profils`).

Données réelles en production (lecture seule) :

| Élément | Valeur |
|---|---|
| Thérapeutes | 12 |
| Places fondateur attribuées / actives | 10 / 10 |
| Thérapeutes Elite Pro | 0 |
| Accès commerciaux accordés | 0 |
| Instantanés d'analyse enregistrés | 0 |
| Certifications | 1 |

Conséquence directe : **8 des 23 cas ne sont pas observables sur les données actuelles**
(n° 2, 3, 4, 5, 6, 7, 14 partiellement, 18). Ils seront couverts par des scénarios
simulés en base dans une transaction annulée (`BEGIN ... ROLLBACK`) : aucune donnée
de production n'est créée ni modifiée.

Points de vigilance repérés à vérifier explicitement pendant les tests :
- `showSeatNumber` vaut `true` quand le réglage `app_settings` est absent (`setting == null`) — comportement par défaut à confirmer comme voulu.
- `seatNumber` est dérivé de `early_rank` et non de `founder_seats.seat_number` : à vérifier au-delà de 70 et après révocation d'une place.
- L'audit lit `therapist_articles.statut = 'publie'` et `service_packages.actif` — cohérence des valeurs réelles à confirmer.
- Expiration d'une offre : le filtrage doit se faire côté SQL (`grant_expires_at`) et non côté UI.

## Plan de tests

### A. Éligibilité et places fondateur (1-7)
Tests SQL sur `advanced_scoring_eligibility` + lecture du résultat via `resolveScoringAccess`.
1. Thérapeutes 1 à 70 : `is_early = true`, source `founding_70`, numéro de place stable.
2. Thérapeute n° 71 : `is_early = false`, niveau `basic`, `seatsRemaining = 0`.
3. Place fondateur conservée après dépassement du quota (le rang reste immuable).
4. Elite Pro simulé : source `elite_pro`, `subscriptionVerified` selon facture en cours.
5. Offre commerciale active (fenêtre `starts_at`/`expires_at` couvrante) : accès avancé.
6. Activation manuelle admin : `grant_source = manual_grant`, accès avancé immédiat.
7. Offre expirée : retour automatique au niveau `basic`, sans intervention.

### B. Score et données (8-14)
8. Score de base sans accès : catégories avancées masquées, score de base exposé.
9. Score avancé avec accès : 8 catégories + critères détaillés.
10. Score administrateur : `forceAdvanced` affiche tout, même pour un profil non éligible.
11. Cloisonnement : un thérapeute connecté ne lit que ses propres données (test navigateur authentifié + tentative d'appel de la fonction serveur sur un autre `therapist_id`).
12. Recommandations issues des données réelles : contrôle croisé entre chaque conseil affiché et l'état effectif du profil en base.
13. Relance d'analyse : le bouton crée un instantané et met à jour la date.
14. Historique : progression calculée entre deux instantanés (nécessite le test 13 d'abord).

### C. Vitrine publique (15-19)
15. Badges Pro sur le profil public et la carte thérapeute.
16/17/18. Certifications vérifiée / déclarée / expirée : affichage distinct et impact correct sur le score (scénarios simulés pour les statuts absents en base).
19. Profil multilingue : rendu FR/DE/IT/EN, balises `hreflang` et JSON-LD.

### D. Rendu et qualité (20-23)
20. Responsive : captures Playwright 375 / 768 / 1440 px du dashboard visibilité, de `/admin/sante-profils` et d'un profil public.
21. Lint.
22. Typecheck.
23. Build de production.

## Restitution
Un tableau unique des 23 cas : statut (OK / anomalie / non observable), preuve
(résultat SQL, capture, sortie de commande) et, pour chaque anomalie, la cause exacte
et le correctif proposé. Aucune modification de code n'est faite avant validation.
