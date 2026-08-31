# Refonte Clients / Facturation / Comptabilité / Suivi & tâches

## Ce qui existe déjà (audit, rien n'a été modifié)

| Demande du brief | État réel aujourd'hui |
|---|---|
| Factures, lignes, TVA, remises, snapshots partiels | `therapist_invoices`, `therapist_invoice_lines`, `vat_rates` |
| Numérotation atomique | `reserve_next_invoice_number` (SQL) |
| QR-facture suisse (QRR / SCOR / NON) | `swiss-invoice.ts` + `swissqrbill`, tests présents |
| PDF / HTML multilingue fr-de-it-en | `invoice-html.server.ts`, `invoice-i18n.ts` |
| Paiements, partiels, solde, statuts, audit | `therapist_invoice_payments`, `therapist_invoice_audit` |
| Avoirs, annulation, verrouillage | `createCreditNote`, `cancelInvoice`, `locked_at` |
| Portail patient signé | `invoice_access_tokens`, route `/facture/$token` |
| Rapprochement bancaire camt.053/054 | `camt054.ts`, `bank-reconciliation.functions.ts` |
| Tarif 590 V6 (135 positions) | `tariff_catalogs` / `tariff_positions`, importé |
| Prestations facturables | `billing_services` |
| Clients CRM | `crm_client_contacts` + `dashboard.clients.tsx` |
| Tâches | `crm_tasks` |
| E-mails | Resend déjà utilisé + `email_logs` + webhook `/api/public/hooks/resend-events` |

**Conclusion : ~70 % du brief est déjà en production.** Le reste est surtout de
l'organisation d'interface, plus quatre briques réellement absentes.

## Ce qui manque vraiment

1. **Fiche client à onglets** (Vue d'ensemble / Rendez-vous / Factures / Paiements / Tâches / Notes privées / Consentements) + filtres de liste (impayé, RDV à venir, adresse incomplète) + création rapide.
2. **Onglets « Rendez-vous à facturer » et « Clients à facturer »** avec sélection multiple d'un même client, exclusion motivée et garde-fou anti double facturation (contrainte SQL sur `appointment_id`).
3. **Comptabilité** : vue d'ensemble chiffrée, journal factures, journal paiements, synthèse TVA, exports CSV (factures / lignes / encaissements / TVA), résumé PDF, pack comptable et « Envoyer à mon comptable » via Resend, avec archives et journalisation.
4. **Suivi & tâches refondu** : onglets À faire / Aujourd'hui / En retard / Terminées, priorité, liens client / RDV / facture, et bandeau « Les nouvelles factures sont gérées dans le module Facturation ».
5. Compléments : historique de statut dédié (`invoice_status_history`), historique d'envoi enrichi, TVA configurable par cabinet (assujettissement, n° TVA, taux autorisés), et `code 999` proposé explicitement.

## Découpage en Loop (un lot livré et validé à la fois)

- **Lot A — Base de données.** Migration additive et idempotente : champs CRM manquants sur `crm_client_contacts` (date de naissance, adresse complète, canton, pays, langue préférée du document, statut), `invoice_status_history`, `accounting_exports`, `email_send_history`, colonnes TVA cabinet sur `therapist_invoice_settings`, contrainte d'unicité anti double facturation sur les lignes liées à un rendez-vous, index (`client_id`, `invoice_id`, `statut`, dates), RLS `is_therapist_owner` et GRANT explicites sur chaque nouvelle table. Aucune donnée existante supprimée ni renommée.
- **Lot B — CRM Clients.** Liste avec recherche, compteur, filtres et affichage responsive ; fiche client à onglets ; actions rapides ; blocage d'émission si adresse incomplète avec le message exact demandé ; suggestion de fusion (jamais automatique).
- **Lot C — Facturation.** Onglets « Rendez-vous à facturer » et « Clients à facturer », assistant en 4 étapes (client & RDV → lignes → échéance & paiement attendu → aperçu filigrané `BROUILLON` puis émission confirmée), option « Paiement reçu sur place », code 999 explicite.
- **Lot D — Comptabilité.** Vue d'ensemble, journaux, synthèse TVA avec l'avertissement fiduciaire, exports CSV UTF-8 BOM, résumé PDF, pack comptable, envoi au comptable via Resend, archives.
- **Lot E — Suivi & tâches + tests.** Refonte des tâches, archives en lecture seule, puis campagne de tests des scénarios 16.1 à 16.13 et récapitulatif technique final.

## Points techniques

- Serveur : `createServerFn` + `requireSupabaseAuth`, aucune Edge Function nouvelle (le webhook Resend existant est réutilisé et enrichi).
- Le `therapist_id` est toujours dérivé du jeton côté serveur, jamais du front-end.
- Numérotation : `reserve_next_invoice_number` conservé (déjà atomique, format `YYYY-XXXX`) ; ajout d'une séquence distincte `AV-YYYY-XXXX` pour les avoirs.
- Aucune donnée de démonstration insérée en production.
- Rien de ce qui fonctionne (agenda, réservations, profils, forfaits, questionnaires, documents, rôles) n'est refactoré.

## Deux décisions à confirmer

1. Le brief parle de `cabinet_id`. Holiswiss n'a pas de table cabinet : tout est scoppé par `therapist_id`. Je garde `therapist_id` comme périmètre (un thérapeute = un cabinet) plutôt que d'introduire une notion de cabinet multi-utilisateurs — c'est non destructif et réversible plus tard.
2. Le brief demande des tables `clients`, `invoices`, `payments`, `tasks`. Elles existent déjà sous d'autres noms (`crm_client_contacts`, `therapist_invoices`, `therapist_invoice_payments`, `crm_tasks`). Je les réutilise au lieu d'en créer de nouvelles, pour ne casser aucune fonctionnalité en production.
