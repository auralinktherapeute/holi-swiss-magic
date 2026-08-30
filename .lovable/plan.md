# Facturation suisse V2 — audit et plan

## 1. Audit de l'existant (rien n'a été modifié)

Le module actuel est déjà substantiel et **fonctionnel** :

| Besoin V2 | État aujourd'hui |
|---|---|
| Factures, lignes, TVA, remise | `therapist_invoices`, `therapist_invoice_lines`, `vat_rates` — OK |
| Numérotation séquentielle serveur | fonction SQL atomique `reserve_next_invoice_number` — OK |
| QR-facture suisse | `swissqrbill@4.4.0` côté serveur, validation IBAN/QR-IBAN/référence — OK, **gratuit, aucune API payante** |
| PDF / HTML | `invoice-html.server.ts` + archivage bucket privé `invoices` — OK |
| Paiements, paiements partiels, solde | `therapist_invoice_payments` + recalcul serveur — OK |
| Avoirs, annulation, verrouillage | `createCreditNote`, `cancelInvoice`, `locked_at`, trigger SQL — OK |
| Statuts + audit | 11 statuts + `therapist_invoice_audit` — OK |
| Rappels, envoi email | `sendInvoiceReminder`, Resend + `email_logs` — OK |
| Rapports + export CSV | `invoice-report.server.ts`, `exportInvoicesCsv` — OK |
| Facture depuis un rendez-vous | `cabinet-billing.server.ts` — OK |
| RLS par thérapeute | `is_therapist_owner` sur toutes les tables — OK |

**Le vrai problème n'est donc pas l'absence de fonctions, c'est que tout est empilé
dans une seule page de 1276 lignes** (`dashboard.facturation.tsx`) : trop de boutons,
aucune hiérarchie, workflow invisible.

### Ce qui manque réellement
1. Navigation par sous-menu (Tableau de bord / Factures / Nouvelle / Paiements / Avoirs / Prestations / Tarif 590 / Rappels / Rapports / Paramètres).
2. Catalogue de **prestations facturables** (distinct des forfaits existants).
3. Catalogue **Tarif 590** versionné + import admin (aucun code inventé).
4. **Portail patient** : lien signé, expirant, révocable.
5. **Rapprochement** des paiements + import **camt.054** idempotent.
6. Tableau de bord chiffré avec graphiques.
7. PDF multilingue FR/DE (IT/EN préparés).

## 2. Principe directeur

**On ne réécrit rien de ce qui marche.** Tout le backend existant est conservé et
réutilisé tel quel. V2 = une couche de navigation simple + les 7 briques manquantes,
ajoutées de façon additive.

## 3. Lots de livraison (le « loop »)

Chaque lot est livré, testé, puis validé avant le suivant.

**Lot 1 — Navigation et parcours simplifié**
Route `dashboard.facturation` transformée en layout avec sous-onglets ; la page
actuelle est découpée sans perte de fonction. Assistant « Nouvelle facture » en
3 écrans : patient → prestations → aperçu/validation. Bouton « Créer une facture »
sur un rendez-vous terminé, avec préremplissage patient/prestation/durée/prix.

**Lot 2 — Prestations et Tarif 590**
Table `billing_services` (nom, description, catégorie, durée, prix, TVA, code interne,
position Tarif 590, actif). Tables `tariff_catalogs` / `tariff_positions` versionnées,
avec écran d'import admin (CSV validé, aucun code inventé) et mention explicite sur
la facture : « Le Tarif 590 est un standard de facturation. Son utilisation ne garantit
pas le remboursement par l'assurance complémentaire. »

**Lot 3 — Portail patient et envoi**
Table `invoice_access_tokens` (jeton haché, expiration, révocation, compteur de vues).
Route publique `/facture/$token` en lecture seule : prestations, montant, échéance,
statut, QR, PDF. Aucune donnée sensible dans l'URL. Email « Votre facture HoliSwiss
est disponible » avec bouton vers le lien signé, via le système Resend existant.

**Lot 4 — Paiements et rapprochement**
Table `payment_matches`. Import camt.054 (parsing XML local, aucune dépendance
payante), idempotence par identifiant de transaction bancaire unique. Recherche par
référence QR, numéro, montant, date : correspondance automatique / suggérée / non
rapprochée, confirmation manuelle obligatoire pour les suggestions.

**Lot 5 — Tableau de bord, rapports, multilingue**
CA du mois et de l'année, encaissé, à recevoir, impayé, graphiques mensuels.
Filtres période/patient/prestation/statut/mode. Export CSV et Excel. PDF FR/DE.

## 4. Points techniques

- Serveur : `createServerFn` + `requireSupabaseAuth` (pas d'Edge Function nouvelle).
- Chaque nouvelle table : `GRANT` explicites, RLS `is_therapist_owner`, `created_at`/`updated_at`.
- QR-facture, PDF, parsing camt : 100 % open source, aucun service payant.
- Intégrations futures (MediData, TWINT, Stripe, banques) : interfaces `*Provider`
  déclarées mais affichant « Cette intégration n'est pas encore configurée ».
- Statuts SQL actuels conservés (aucune migration destructive) ; le mapping vers les
  libellés demandés se fait à l'affichage.
- Tests : suites vitest existantes étendues (calculs, TVA, QR, numérotation, paiements
  partiels, avoirs, idempotence camt, expiration de lien, RLS).

## 5. Ce dont j'ai besoin de toi

1. Je démarre par le **Lot 1** seul (navigation + assistant), puis on valide ensemble
   avant d'enchaîner — c'est bien la logique de « loop » que tu veux ?
2. Tarif 590 : as-tu un fichier de catalogue officiel à importer, ou je livre
   uniquement l'écran d'import en attendant que tu fournisses le fichier ?
3. Les anciennes factures (`invoices` du CRM, lecture seule) restent-elles visibles
   dans un onglet « Archives » ?
