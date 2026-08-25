# CRM admin Holiswiss — Audit et plan (aucune modification effectuée)

## 1. Architecture actuelle

- Route unique `src/routes/admin.crm.tsx` (578 lignes) avec 4 onglets : Pipeline (kanban), Liste, Tâches, Relances.
- Vues : `src/components/crm/AdminCrmViews.tsx` (liste, centre de tâches, centre de relances).
- Serveur : `src/lib/crm.functions.ts` (côté admin) et `src/lib/crm-therapist.functions.ts` (CRM du thérapeute, séparé).
- Toutes les fonctions admin passent par `requireSupabaseAuth` + `assertAdmin(context.userId)` puis `supabaseAdmin` (bypass RLS). Accès correct aujourd'hui.
- Le « Ouvrir » actuel ouvre un panneau léger : lead + activités + tâches. Pas de fiche complète.

## 2. Tables et relations

- **`crm_leads`** — source unique des lignes affichées. Colonnes : identité, email, phone, canton, specialty, source, status, priority, assigned_to, notes, last_contact_at, `converted_therapist_id`, dates. **Aucune contrainte d'unicité.**
- `crm_activities` (entity_type: lead | therapist | contact/client_contact, entity_id, type, occurred_at) — timeline déjà en place.
- `crm_tasks`, `crm_pipelines`, `crm_stages`, `crm_tags`, `crm_contact_tags`.
- `crm_client_contacts`, `crm_session_notes`, `crm_intake_submissions` — **appartiennent au thérapeute**, pas au CRM admin (RLS « no admin » sur les contacts).
- Rattachables à la fiche : `therapists`, `user_roles`, `waiting_list`, `email_logs`, `events`, `therapist_articles`, `articles`, `reviews`, `appointments`, `subscription_invoices`, `therapist_invoices`, `therapist_health_scores` / `therapist_showcase_snapshots`, `notifications`, `user_sessions`, `founder_seats`.
- Clés de jointure disponibles : `therapists.id` ⇄ `crm_leads.converted_therapist_id`, `therapists.user_id` ⇄ auth, sinon **email** (seule clé fiable pour la waitlist, qui n'a pas de `therapist_id`).

## 3. Causes des doublons (confirmées en production)

21 leads pour 14 emails distincts → 6 groupes de doublons certains (Chabal, Arshakuni, Larue, Chardon, Roch, alouzao, DAYALAN).

1. **Deux triggers indépendants insèrent sans déduplication** : `trg_crm_lead_from_waitlist` (source `waitlist`, statut `new`) et `trg_crm_lead_from_therapist` (source `inscription`, statut `pending`). Un thérapeute qui s'inscrit après avoir laissé son email en waitlist génère 2 lignes.
2. `ON CONFLICT DO NOTHING` est **inopérant** : aucun index unique sur email / phone / `converted_therapist_id`.
3. Aucune normalisation avant comparaison (casse email, format téléphone `+4179…` vs `0764…`, accents/espaces sur le nom).
4. Le lead waitlist n'est jamais rattaché au thérapeute créé ensuite (`converted_therapist_id` reste NULL) → il reste un « lead fantôme » relancé à tort.

## 4. Risques de régression

- `trg_crm_lead_promote_loyal` et les relances ciblent `converted_therapist_id` ; une fusion mal faite casse la promotion « fidélisé ».
- Le kanban lit `status` avec 9 valeurs mais n'affiche que 6 colonnes (`followup`, `converted`, `elite_pro` invisibles) — bug existant à corriger.
- `crm_activities.entity_id` n'a pas de FK : une fusion doit réattribuer explicitement, sinon activités orphelines.
- `crm_client_contacts` contient des données de patients : ne jamais l'exposer dans le CRM admin.
- `select("*")` sur `crm_leads` : à remplacer par des projections explicites.

## 5. Réutilisable tel quel

Timeline `crm_activities`, tâches, relances, `assertAdmin`, templates + envoi email (`custom-email.functions.ts`, `email_logs`), santé de profil (`showcase-report.ts`, `therapist_health_scores`), design sombre/violet des cartes.

## 6. Migrations nécessaires (à valider avant écriture)

1. Colonnes de normalisation générées sur `crm_leads` : `email_norm`, `phone_norm`, `name_norm` (+ index).
2. Colonnes de cycle de vie : `merged_into_id uuid`, `merged_at`, `archived_at`, `dedup_status` (`open|ignored|confirmed|merged`).
3. Table `crm_merge_log` (snapshot JSONB avant fusion, auteur, cibles, rollback) + GRANTs `service_role`.
4. Table `crm_field_history` (champ, ancienne/nouvelle valeur, auteur, origine) pour l'onglet Historique.
5. Réécriture des deux triggers en **upsert par email normalisé** : rattachement au lead existant + activité, au lieu d'une nouvelle ligne.
6. Index unique partiel sur `email_norm` **uniquement après** dédoublonnage manuel (sinon la migration échoue).

Aucune suppression de données : le doublon est archivé (`dedup_status='merged'`, `merged_into_id`).

## 7. Plan d'implémentation

**P0 — socle et doublons**
1. Migration 1+2+5 (normalisation, cycle de vie, triggers upsert) — arrête la création de nouveaux doublons.
2. Liste consolidée : une ligne par personne, pagination + recherche + filtres serveur, badge doublon, colonnes demandées.
3. Page/filtre « Doublons » gradué (certain / probable / à examiner) avec raison et statut.
4. Écran de comparaison côte à côte + fusion **manuelle** avec choix du maître, aperçu des réattributions, `crm_merge_log`, rollback.

**P1 — fiche complète**
5. Fiche unique par thérapeute avec en-tête + onglets chargés en différé : Vue d'ensemble, Informations, Notes, Emails, Activités, Événements, Articles, Santé du profil, Avis, Abonnement/Facturation (rôle admin), Réservations (agrégats seulement), Historique.
6. Journalisation des actions sensibles + confirmations.
7. Tests : accès admin/refus, filtres, détection (email/téléphone/nom+ville), faux positifs, fusion + rollback + conservation des relations, envoi email, non-exposition des données patients.

**P2 — enrichissement**
8. Pipeline complet 7 étapes, responsable interne, tags/segments, score de priorité et de désengagement, tableau de bord CRM, rapport hebdo qualité des données, recherche globale. Zoho : non recommandé pour l'instant (double source de vérité).

## Ce dont j'ai besoin de toi

Validation de ce plan, et confirmation sur deux points : (a) fusionner d'abord les 6 doublons existants manuellement via l'écran de comparaison plutôt qu'en SQL ; (b) l'onglet Facturation visible pour tous les admins ou seulement toi.
