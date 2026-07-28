# Feature — Récapitulatif santé de profil complet + améliorations agent

## Périmètre confirmé
16 sous-items regroupés en 3 lots. Livraison en une seule passe cohérente (migration DB + serveur + email + UI admin).

## Lot 1 — Migration base (une seule migration)
1. `therapists.last_sign_in_at` (timestamptz) — remplie par trigger sur `auth.users.last_sign_in_at` OU lue directement via `auth.admin.getUserById` côté serveur (préférence : lecture à la volée, pas de trigger sur `auth.*` qui est interdit).
2. `therapist_health_scores.last_recap_sent_at` (timestamptz) + `score_reactivite` (int, 0-10) + `score_previous` (int) capturé lors du recompute.
3. Nouveau critère **Réactivité** dans `compute_therapist_health` : délai moyen entre `contact_messages.created_at` ciblés au thérapeute et sa 1ʳᵉ réponse (heuristique : `crm_activities` type=`reply` sur l'entité message). Poids : 10 pts pris sur Activité (25→15) OU ajout d'une 5ᵉ catégorie (35+15+15+15+20=100). **Choix : 5ᵉ catégorie** pour ne pas dérégler les scores existants.
   - Recalibrage : Complétude 30, Contenu 20, Activité 15, Visibilité 20, Réactivité 15 = 100.
4. Historisation `score_previous` : à chaque `compute_therapist_health`, copier l'ancien `score_total` dans `score_previous` avant update, pour calculer la tendance.

## Lot 2 — Serveur & email
5. `sendProfileHealthRecap` (nouvelle serverFn) : envoie le récapitulatif COMPLET (score, breakdown par catégorie, TOUS les points forts, TOUTES les actions triées par gain), pas seulement top 3. Met à jour `last_recap_sent_at`.
6. Nouveau template `profile-health-recap.server.ts` (garde le style violet actuel) :
   - Intro pédagogique (à quoi sert le score, comment le lire)
   - Score global + 5 catégories
   - Points forts complets, actions complètes (label + explication courte du "pourquoi" par action)
   - Personnalisation par spécialité (« En tant que praticien en X… »)
   - Reformulation : « visibilité sur Google **et sur les assistants IA (ChatGPT, Gemini…)** »
   - Preuve sociale factuelle générique (« les profils complets sont plus souvent contactés »)
   - Cadence annoncée : « point mensuel »
   - Lien d'aide : `mailto:contact@holiswiss.ch`
   - **JAMAIS** de mention de citabilité IA
7. Bibliothèque locale de "pourquoi" par code de recommandation (`RECO_EXPLAIN`) — pas de LLM à l'envoi.
8. Conserver l'ancien `sendProfileHealthInvite` (email court) OU le remplacer ? **Remplacement** : le bouton "Inviter" devient "Envoyer le récapitulatif complet". L'ancien template est retiré.

## Lot 3 — UI admin (`admin.sante-profils.tsx`)
9. Bouton "Envoyer le récapitulatif" (remplace "Inviter") + affichage de `last_recap_sent_at` sous le bouton.
10. Affichage `Dernière connexion` à côté de « Inscrit le … ».
11. Flèche de tendance ↑ ↓ → dans la liste, calculée `score - score_previous`.
12. Barre de filtres au-dessus de la liste : recherche nom, sélecteur canton, tri (score asc/desc, ancienneté, tendance).
13. Bloc comparaison : « Vous : X/100 · Moyenne pour {spécialité} : Y/100 » (calculée serveur via `getHealthDetail` étendu).
14. 5ᵉ tuile "Réactivité" dans la grille de catégories.

## Détails techniques (non montrés à l'utilisateur non-tech dans le récap)
- Migration idempotente ; GRANT posés ; RLS admin-only conservée.
- `getHealthDetail` renvoie en plus `last_sign_in_at` (via `supabaseAdmin.auth.admin.getUserById`), `specialty_average`, `previous_score`.
- `listHealthScores` renvoie `score_previous` pour la tendance.
- Explications par recommandation : dictionnaire dans `profile-health-recap.server.ts` mappé sur `therapist_health_recommendations.code`.

## Ordre d'exécution
1. Migration DB (Réactivité, colonnes, recalibrage `compute_therapist_health`).
2. Serveur : nouvelle serverFn + template email + extension `getHealthDetail` / `listHealthScores`.
3. UI admin : filtres, tri, tendance, dernière connexion, comparaison, bouton récap.
4. Vérification manuelle sur `holiswiss.ch` en prod après build Lovable.

## Question à trancher avant exécution
- **Réactivité** : la table `contact_messages` est globale (formulaire contact du site) ; il n'y a pas aujourd'hui de trace de « réponse thérapeute à un client » horodatée dans la DB (pas de messagerie interne). Trois options :
  - A. Calculer sur `appointments` : délai entre `created_at` du RDV et confirmation → mesure indirecte.
  - B. Créer une vraie table de messages plus tard, et pour l'instant mettre le critère à `null` (affiché « à venir ») pour ne pas fausser le score.
  - C. Baser sur `client_questionnaire_responses.statut` (soumis→traite) : délai de traitement.
  
  **Recommandation : B** (afficher le critère, score neutre 10/15 par défaut, message « en cours de calibrage ») — évite d'inventer un signal, cohérent avec ta règle « pas de donnée inventée ».
