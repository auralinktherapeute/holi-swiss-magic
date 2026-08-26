# CRM thérapeute + facturation suisse — Audit (Phase 0) et plan

Aucun fichier, aucune table, aucune politique n'a été modifié. Rien n'a été généré.

## 1. Ce qui existe déjà

**Tableau de bord thérapeute** (TanStack Start, routes `src/routes/dashboard.*.tsx`) : profil, agenda, réservations, avis, articles, événements, forfaits, questionnaires, abonnement, visibilité, CRM, facturation.

**CRM thérapeute** — `src/routes/dashboard.crm.tsx` (951 lignes) + `src/components/crm/TherapistCrmViews.tsx`, serveur `src/lib/crm-therapist.functions.ts` (contacts, notes de séance SOAP, tâches, rappels, segmentation, import en masse). Tables : `crm_client_contacts` (3 lignes), `crm_session_notes`, `crm_tasks`, `crm_activities`.

**Facturation** — deux systèmes coexistent, c'est le problème central :

| | Table | Utilisé par | Contenu |
|---|---|---|---|
| A | `invoices` + `invoice_items` | onglet Factures du CRM (`invoice.functions.ts`) | 1 facture, pas de TVA, pas de QR |
| B | `therapist_invoices` + `therapist_invoice_settings` | page `/dashboard/facturation` (`therapist-invoices.functions.ts`) | 0 facture, 0 réglage — jamais utilisé en production |

Le système B est le plus complet : numérotation séquentielle atomique (`reserve_next_invoice_number`), TVA, `qr_reference`, QR-facture via `swissqrbill@4.4.0` (`invoice-html.server.ts`), archivage PDF dans le bucket privé `invoices`, envoi email via Resend (`sendInvoiceEmail`).

**Sécurité existante** : RLS `is_therapist_owner` sur toutes les tables de facturation, `crm_client_contacts` en « no admin » (les patients ne sont jamais visibles par l'admin), 6 buckets tous privés dont `invoices`.

## 2. Réutilisable tel quel

`reserve_next_invoice_number`, `swissqrbill`, `buildInvoiceHtml`, bucket `invoices` + URLs signées, `sendInvoiceEmail` + `email_logs`, RLS `is_therapist_owner`, `crm_client_contacts` comme référentiel client unique, `appointments` et `client_packages` comme sources de lignes de facture.

## 3. Ce qui manque

**Réglages émetteur** : raison sociale, IDE, téléphone, email pro, logo, titulaire du compte et son adresse, distinction IBAN / QR-IBAN, devise par défaut, délai de paiement, conditions, mention TVA personnalisée, mode TVA (incluse / en sus), statut d'assujettissement explicite.

**Facture** : date de prestation, date d'échéance, remise par ligne, TVA par ligne (aujourd'hui un seul taux global), adresse structurée du destinataire (NPA/ville/pays séparés), référence de paiement typée (QR / SCOR / libre), verrouillage après validation, lien vers facture rectificative ou avoir.

**Statuts** : aujourd'hui 3 (`en_attente`, `paye`, `annule`). Manquent brouillon, envoyée, consultée, partiellement payée, en retard, avoir, erreur d'envoi.

**Absents totalement** : table des paiements (aucun suivi d'encaissement, solde, mode de paiement), avoirs / notes de crédit, journal d'audit financier, rapports, taux de TVA configurables (2,6 / 3,8 / 8,1 % ne sont nulle part).

**QR-facture** : aucune validation IBAN / QR-IBAN (mod-97, structure CH), aucune validation de la référence QR (chiffre de contrôle modulo 10 récursif), aucun blocage si les données obligatoires manquent. Règle SIX : la référence QR n'est valide qu'avec un QR-IBAN (IID 30000–31999) ; avec un IBAN normal, référence SCOR ou communication libre uniquement.

## 4. Risques

1. **Deux systèmes de factures** — migrer sans précaution casserait l'onglet Factures du CRM. Le système A contient 1 vraie facture à préserver.
2. Numérotation : toute réécriture doit passer par la fonction atomique existante, sinon doublons.
3. `crm_client_contacts` contient des données de patients : ne jamais l'exposer à l'admin ni à une page publique.
4. Une facture validée ne doit plus être modifiable — sans verrou SQL, le frontend suffit à la modifier aujourd'hui.
5. Montants calculés côté client dans le système A : à recalculer côté serveur.

## 5. Migrations nécessaires

1. Extension `therapist_invoice_settings` : identité émetteur, IDE, logo, titulaire, QR-IBAN, devise, délai, conditions, mode TVA, `is_complete` calculé.
2. Extension `therapist_invoices` : `statut` (enum étendu), dates prestation/échéance, adresse destinataire structurée, type de référence, `locked_at`, `cancelled_at`, `credit_note_of_id`, `corrects_invoice_id`.
3. Nouvelle table `therapist_invoice_lines` (description, quantité, PU, remise, taux TVA par ligne).
4. Nouvelle table `therapist_invoice_payments` (montant, date, mode, référence, remboursement).
5. Nouvelle table `therapist_invoice_audit` (action, auteur, avant/après).
6. Table de référence `vat_rates` (taux configurables, jamais codés en dur).
7. Trigger de verrouillage : refus de tout UPDATE des champs financiers quand `locked_at` est renseigné.
8. Migration douce du système A vers B, sans suppression : les anciennes factures restent lisibles.

GRANT explicites + RLS `is_therapist_owner` sur chaque nouvelle table. Aucune suppression de données.

## 6. Plan P0 / P1 / P2

**P0 — socle facturation suisse conforme**
1. Migrations 1 à 7.
2. Page « Paramètres de facturation » complète, avec validation bloquante avant première facture et avertissement TVA (« Vérifiez le taux applicable avec votre fiduciaire ou l'AFC »).
3. Création de facture : lignes multiples, remise, TVA par ligne, brouillon → aperçu → validation (verrouillage), depuis une réservation, un forfait ou manuellement.
4. QR-facture : validation IBAN / QR-IBAN / référence avec chiffres de contrôle, blocage explicite et liste des champs manquants si incomplet.
5. PDF professionnel FR : sections réception / paiement / informations, logo, mentions obligatoires.

**P1 — cycle de vie et CRM premium**
6. Statuts complets, annulation, facture rectificative, avoir — chaque action confirmée et journalisée.
7. Paiements : encaissements, paiements partiels, solde, retard, rapprochement manuel. Jamais de passage automatique à « payée ».
8. Envoi email + relances avant/après échéance, confirmation de paiement, envoi d'avoir — tout tracé dans `email_logs`.
9. CRM : fiche client unifiée (identité, réservations, prestations, factures, paiements, notes privées, emails, tâches, dernière activité, prochaine action, historique) et navigation Vue d'ensemble / Clients / Réservations / Prestations / Factures / Paiements / Notes / Emails / Tâches / Rapports / Paramètres.

**P2 — rapports et finitions**
10. Chiffre d'affaires facturé et encaissé, en attente, en retard, avoirs, TVA collectée, prestations les plus facturées, évolution mensuelle, export CSV.
11. Tests automatisés (les 12 scénarios demandés : sans TVA, 8,1 %, 2,6 %, données incomplètes, multi-lignes, remise, payée, partiellement payée, avoir, erreur d'envoi, utilisateur non autorisé, modification d'une facture validée).
12. Architecture multilingue du PDF.

## Ce dont j'ai besoin de toi

1. **Unification** : je consolide tout sur `therapist_invoices` (le plus complet) en conservant l'ancienne facture en lecture seule — d'accord ?
2. **Périmètre du premier lot** : je livre P0 seul d'abord, ou P0 + P1 d'un bloc ?
3. **Numérotation** : format actuel conservé (séquentiel annuel par thérapeute) ou format imposé par ton fiduciaire ?
