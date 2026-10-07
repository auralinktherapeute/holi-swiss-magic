# Page Clients — gestion complète (plan à valider, rien n'est modifié)

## Constat (audit en lecture seule)
Une fiche existe déjà : cliquer sur un client ouvre une fenêtre avec coordonnées, modification, consentement (case simple), factures + facture rapide, tâches, notes de séance, documents. Elle reste en place ; on l'enrichit sans la remplacer.

Déjà en production et réutilisé tel quel :
- Clients : `crm_client_contacts` (adresse, date de naissance, statut)
- Notes : `crm_session_notes` + `crm_activities`
- Documents : `therapist_documents` + bucket privé existant
- Questionnaires : `questionnaires`, `questionnaire_assignments`, `client_questionnaire_responses`
- Factures/paiements : module Facturation (`therapist_invoices`, `QuickInvoiceDialog`)
- Rendez-vous : `appointments`
- Historique de champs : `crm_field_history`, fusion : `crm_merge_log`
- Envois : `email_send_history` + Resend déjà branché

## Ce qui sera ajouté (lots séparés, validés un par un)

**Lot 1 — Fiche à onglets** (même fenêtre, même thème)
```text
[Nom]  [Statut ▾ Actif/Prospect/Inactif]  [Modifier] [Archiver] [Supprimer]
Onglets : Infos | Notes | Rendez-vous | Facturation | Consentement
          | Documents | Questionnaires | Journal
```
- Infos : coordonnées + tags (`crm_tags` existant), validation e-mail/téléphone.
- Notes : ajout daté et signé, jamais modifiées (historique conservé).
- Rendez-vous : passés / à venir ; « Nouveau rendez-vous » ouvre l'agenda existant avec le client prérempli.
- Facturation : factures, statut, solde ; « Créer une facture » = module existant.
- Documents : PDF/images ≤ 10 Mo, aperçu par lien signé limité dans le temps.
- Questionnaires : assigner, statut, dates, « Renvoyer ».
- Journal : chronologie fusionnée (création, modifs, RDV, factures, consentements, documents, questionnaires, e-mails).
- Bouton « Nouveau client » en haut de la liste.
- Supprimer : fenêtre de confirmation listant factures/RDV/documents liés ; si factures émises, suppression refusée → archivage proposé (obligation légale de conservation).

**Lot 2 — Envois d'e-mails** (consentement, relance facture, questionnaire)
- Aperçu complet (destinataire, objet, texte) + confirmation obligatoire.
- Expéditeur : adresse officielle Holiswiss, « Répondre à » = e-mail du thérapeute.
- Chaque envoi journalisé (envoyé / échec), message clair en cas d'échec.

**Lot 3 — Doublons et fusion manuelle**
- Détection : même e-mail normalisé, même téléphone normalisé (`crm_norm_email`/`crm_norm_phone` existants), ou nom très proche (similarité ≥ 0,85 après suppression des accents).
- Fusion : choix de la fiche à garder, rattachement RDV/factures/consentements/documents/questionnaires, l'autre fiche archivée (jamais supprimée), trace dans `crm_merge_log`.

## Schéma — seuls ajouts (migration additive, à autoriser séparément)
- `crm_client_contacts` : `archived_at timestamptz` (si absent), `consent_requested_at`, `consent_expires_at`.
- `crm_client_audit` (nouvelle) : `id, therapist_id, contact_id, actor_id, action, details jsonb, created_at` — ajout seul, aucune modification ni suppression ; RLS propriétaire + GRANT.
- Aucune colonne renommée ni supprimée. Les colonnes réellement présentes en production seront vérifiées avant d'écrire la migration.

## E-mails — configuration
- Service : Resend, déjà utilisé par Holiswiss ; clé déjà stockée côté serveur dans les secrets, jamais dans le navigateur.
- Domaine expéditeur : le domaine Holiswiss déjà vérifié chez Resend (à confirmer).
- Aucune nouvelle clé à saisir si celle existante convient.

## Sécurité
- Le thérapeute est toujours déduit de sa session côté serveur ; RLS sur chaque table.
- Notes : rappel à l'écran « notes d'organisation uniquement, pas de dossier médical ».

## Points techniques
- Fonctions serveur `createServerFn` + `requireSupabaseAuth`, aucune nouvelle Edge Function.
- Fichiers touchés : `dashboard.clients.tsx` (onglets), nouveaux composants isolés, `crm-therapist.functions.ts` (ajouts seulement).
- Aucune publication sans votre accord.
